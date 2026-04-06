import asyncio
import time
import uuid
from typing import Dict, List, Set
from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field, ValidationError

from models import (
    CacheConfig, CacheUpdateEvent, MappingType, ReplacementPolicy,
    TraceConfig, SessionSummary
)
from cache_engine import CacheEngine
from trace_generator import TraceGenerator
from serial_reader import get_serial_reader, SerialReader
from database import (
    init_db, create_session, log_access, update_session_stats,
    list_sessions, export_session_csv, get_session
)

active_engines: Dict[str, CacheEngine] = {}
active_serial_readers: Dict[str, SerialReader] = {}
connected_clients: Dict[str, Set[WebSocket]] = {}
running_tasks: Dict[str, asyncio.Task] = {}
last_activity: Dict[str, float] = {}

logger = logging.getLogger(__name__)
SESSION_TTL_SECONDS = 3600
CLEANUP_INTERVAL_SECONDS = 300


class AccessRequest(BaseModel):
    address: int = Field(..., ge=0, le=255)


class WebSocketMessage(BaseModel):
    type: str
    address: int | None = Field(default=None, ge=0, le=255)


def touch_session(session_id: str):
    last_activity[session_id] = time.time()


async def cleanup_stale_sessions():
    cutoff = time.time() - SESSION_TTL_SECONDS
    stale_session_ids = [sid for sid, ts in last_activity.items() if ts < cutoff]
    for session_id in stale_session_ids:
        if connected_clients.get(session_id):
            continue
        task = running_tasks.pop(session_id, None)
        if task and not task.done():
            task.cancel()
        reader = active_serial_readers.pop(session_id, None)
        if reader:
            reader.stop()
        active_engines.pop(session_id, None)
        connected_clients.pop(session_id, None)
        last_activity.pop(session_id, None)


async def cleanup_loop():
    while True:
        await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)
        await cleanup_stale_sessions()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    cleanup_task = asyncio.create_task(cleanup_loop())
    yield
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass
    for reader in active_serial_readers.values():
        reader.stop()
    for task in running_tasks.values():
        task.cancel()


app = FastAPI(
    title="Cache Memory Mapping & Performance Analyzer",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def broadcast_to_session(session_id: str, data: dict):
    if session_id in connected_clients:
        dead = set()
        for ws in connected_clients[session_id]:
            try:
                await ws.send_json(data)
            except Exception:
                logger.exception("Failed to broadcast to websocket client for session %s", session_id)
                dead.add(ws)
        connected_clients[session_id] -= dead


@app.post("/api/session", response_model=dict)
async def create_new_session(config: CacheConfig):
    session_id = str(uuid.uuid4())[:8]
    engine = CacheEngine(config)
    active_engines[session_id] = engine
    connected_clients[session_id] = set()
    touch_session(session_id)
    await create_session(session_id, config)
    return {"session_id": session_id, "config": config.model_dump()}


@app.get("/api/sessions", response_model=List[SessionSummary])
async def get_sessions():
    return await list_sessions()


@app.get("/api/session/{session_id}")
async def get_session_info(session_id: str):
    if session_id not in active_engines:
        session_data = await get_session(session_id)
        if session_data:
            return session_data
        raise HTTPException(status_code=404, detail="Session not found")
    engine = active_engines[session_id]
    state = engine.get_state()
    return {
        "session_id": session_id,
        "state": state.model_dump(),
        "config": engine.config.model_dump(),
    }


@app.post("/api/session/{session_id}/access")
async def manual_access(session_id: str, address: int = Query(..., ge=0, le=255)):
    if session_id not in active_engines:
        raise HTTPException(status_code=404, detail="Session not found")

    payload = AccessRequest(address=address)
    engine = active_engines[session_id]
    result = engine.access(payload.address)
    state = engine.get_state()
    touch_session(session_id)

    await log_access(
        session_id, payload.address, result.tag, result.index,
        result.hit, result.evicted_address, result.cache_line_index
    )
    await update_session_stats(
        session_id, state.total_accesses, state.hits, state.misses,
        state.hit_rate, state.miss_rate, state.amat
    )

    event = CacheUpdateEvent(
        event="cache_update",
        access=result,
        state=state,
        session_id=session_id,
        timestamp=time.time(),
    )
    await broadcast_to_session(session_id, event.model_dump())
    return event.model_dump()


@app.post("/api/session/{session_id}/trace")
async def run_trace(session_id: str, config: TraceConfig):
    if session_id not in active_engines:
        raise HTTPException(status_code=404, detail="Session not found")

    touch_session(session_id)
    engine = active_engines[session_id]
    generator = TraceGenerator(config)
    addresses = generator.generate_batch()

    results = []
    for addr in addresses:
        result = engine.access(addr)
        state = engine.get_state()

        await log_access(
            session_id, addr, result.tag, result.index,
            result.hit, result.evicted_address, result.cache_line_index
        )

        event = CacheUpdateEvent(
            event="cache_update",
            access=result,
            state=state,
            session_id=session_id,
            timestamp=time.time(),
        )
        await broadcast_to_session(session_id, event.model_dump())
        results.append(event.model_dump())
        await asyncio.sleep(0.05)

    final_state = engine.get_state()
    await update_session_stats(
        session_id, final_state.total_accesses, final_state.hits, final_state.misses,
        final_state.hit_rate, final_state.miss_rate, final_state.amat
    )

    return {"total": len(results), "final_state": final_state.model_dump()}


@app.post("/api/session/{session_id}/serial/start")
async def start_serial(session_id: str):
    if session_id not in active_engines:
        raise HTTPException(status_code=404, detail="Session not found")

    if session_id in running_tasks and not running_tasks[session_id].done():
        return {"status": "already_running"}

    engine = active_engines[session_id]
    reader = get_serial_reader(2 ** engine.config.address_bits)
    reader.start()
    active_serial_readers[session_id] = reader

    async def serial_loop():
        try:
            async for addr in reader.read_stream():
                if session_id not in active_engines:
                    break
                result = engine.access(addr)
                state = engine.get_state()
                touch_session(session_id)

                await log_access(
                    session_id, addr, result.tag, result.index,
                    result.hit, result.evicted_address, result.cache_line_index
                )

                event = CacheUpdateEvent(
                    event="cache_update",
                    access=result,
                    state=state,
                    session_id=session_id,
                    timestamp=time.time(),
                )
                await broadcast_to_session(session_id, event.model_dump())

            final_state = engine.get_state()
            await update_session_stats(
                session_id, final_state.total_accesses, final_state.hits,
                final_state.misses, final_state.hit_rate, final_state.miss_rate,
                final_state.amat
            )
        except asyncio.CancelledError:
            logger.info("Serial loop cancelled for session %s", session_id)
        except Exception:
            logger.exception("Unhandled serial loop error for session %s", session_id)
        finally:
            await cleanup_stale_sessions()

    task = asyncio.create_task(serial_loop())
    running_tasks[session_id] = task
    return {"status": "started"}


@app.post("/api/session/{session_id}/serial/stop")
async def stop_serial(session_id: str):
    if session_id in active_serial_readers:
        active_serial_readers[session_id].stop()
        del active_serial_readers[session_id]
    if session_id in running_tasks:
        running_tasks[session_id].cancel()
        del running_tasks[session_id]
    touch_session(session_id)
    await cleanup_stale_sessions()
    return {"status": "stopped"}


@app.post("/api/session/{session_id}/reset")
async def reset_session(session_id: str):
    if session_id not in active_engines:
        raise HTTPException(status_code=404, detail="Session not found")
    active_engines[session_id].reset()
    state = active_engines[session_id].get_state()
    touch_session(session_id)
    await update_session_stats(session_id, 0, 0, 0, 0.0, 0.0, 1.0)
    await broadcast_to_session(
        session_id,
        {"event": "cache_reset", "state": state.model_dump(), "session_id": session_id},
    )
    return {"status": "reset", "state": state.model_dump()}


@app.get("/api/session/{session_id}/heatmap")
async def get_heatmap(session_id: str):
    if session_id not in active_engines:
        raise HTTPException(status_code=404, detail="Session not found")
    touch_session(session_id)
    return active_engines[session_id].get_heatmap()


@app.get("/api/export/{session_id}")
async def export_csv(session_id: str):
    csv_data = await export_session_csv(session_id)
    if csv_data is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return PlainTextResponse(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=cache_session_{session_id}.csv"},
    )


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()

    if session_id not in connected_clients:
        connected_clients[session_id] = set()
    connected_clients[session_id].add(websocket)
    touch_session(session_id)

    try:
        if session_id in active_engines:
            state = active_engines[session_id].get_state()
            await websocket.send_json({
                "event": "connected",
                "session_id": session_id,
                "state": state.model_dump(),
            })

        while True:
            data = await websocket.receive_text()
            try:
                msg = WebSocketMessage.model_validate_json(data)
            except ValidationError:
                logger.warning("Invalid websocket payload for session %s", session_id)
                continue
            touch_session(session_id)

            if msg.type == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            if msg.type == "access" and session_id in active_engines:
                if msg.address is None:
                    logger.warning("Access websocket message missing address for session %s", session_id)
                    continue
                address = msg.address
                engine = active_engines[session_id]
                result = engine.access(address)
                state = engine.get_state()

                await log_access(
                    session_id, address, result.tag, result.index,
                    result.hit, result.evicted_address, result.cache_line_index
                )
                await update_session_stats(
                    session_id, state.total_accesses, state.hits, state.misses,
                    state.hit_rate, state.miss_rate, state.amat
                )

                event = CacheUpdateEvent(
                    event="cache_update",
                    access=result,
                    state=state,
                    session_id=session_id,
                    timestamp=time.time(),
                )
                await broadcast_to_session(session_id, event.model_dump())

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for session %s", session_id)
    except Exception:
        logger.exception("Unhandled websocket error for session %s", session_id)
    finally:
        if session_id in connected_clients:
            connected_clients[session_id].discard(websocket)
            if not connected_clients[session_id]:
                connected_clients.pop(session_id, None)
        await cleanup_stale_sessions()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
