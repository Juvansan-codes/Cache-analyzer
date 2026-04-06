import asyncio
import json
import time
import uuid
from typing import Dict, List, Set
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

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


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
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
    allow_origins=["*"],
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
                dead.add(ws)
        connected_clients[session_id] -= dead


@app.post("/api/session", response_model=dict)
async def create_new_session(config: CacheConfig):
    session_id = str(uuid.uuid4())[:8]
    engine = CacheEngine(config)
    active_engines[session_id] = engine
    connected_clients[session_id] = set()
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
async def manual_access(session_id: str, address: int = Query(...)):
    if session_id not in active_engines:
        raise HTTPException(status_code=404, detail="Session not found")

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
    return event.model_dump()


@app.post("/api/session/{session_id}/trace")
async def run_trace(session_id: str, config: TraceConfig):
    if session_id not in active_engines:
        raise HTTPException(status_code=404, detail="Session not found")

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
            pass

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
    return {"status": "stopped"}


@app.post("/api/session/{session_id}/reset")
async def reset_session(session_id: str):
    if session_id not in active_engines:
        raise HTTPException(status_code=404, detail="Session not found")
    active_engines[session_id].reset()
    state = active_engines[session_id].get_state()
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
            msg = json.loads(data)

            if msg.get("type") == "access" and session_id in active_engines:
                address = msg.get("address", 0)
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
        pass
    except Exception:
        pass
    finally:
        if session_id in connected_clients:
            connected_clients[session_id].discard(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
