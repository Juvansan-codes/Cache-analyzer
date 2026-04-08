import aiosqlite
import os
import time
import asyncio
from contextlib import asynccontextmanager
from typing import List, Optional, Dict, Tuple
from models import CacheConfig, SessionSummary

DB_PATH = os.getenv("DB_PATH", "cache_analyzer.db")
ACCESS_LOG_BATCH_SIZE = 25
_pending_access_logs: List[Tuple[str, int, int, int, int, Optional[int], int, float]] = []
_access_log_lock = asyncio.Lock()

@asynccontextmanager
async def get_connection():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("PRAGMA journal_mode=WAL")
        await db.execute("PRAGMA busy_timeout=5000")
        yield db


async def flush_access_logs(force: bool = False):
    async with _access_log_lock:
        if not _pending_access_logs:
            return
        if not force and len(_pending_access_logs) < ACCESS_LOG_BATCH_SIZE:
            return
        batch = list(_pending_access_logs)
        _pending_access_logs.clear()

    try:
        async with get_connection() as db:
            await db.executemany(
                """INSERT INTO access_log
                   (session_id, address, tag, set_index, hit, evicted_address, cache_line_index, timestamp)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                batch,
            )
            await db.commit()
    except Exception:
        async with _access_log_lock:
            _pending_access_logs[:0] = batch
        raise

async def init_db():
    async with get_connection() as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                mapping_type TEXT NOT NULL,
                replacement_policy TEXT NOT NULL,
                cache_size INTEGER NOT NULL,
                block_size INTEGER NOT NULL,
                associativity INTEGER NOT NULL,
                address_bits INTEGER NOT NULL,
                total_accesses INTEGER DEFAULT 0,
                hits INTEGER DEFAULT 0,
                misses INTEGER DEFAULT 0,
                hit_rate REAL DEFAULT 0.0,
                miss_rate REAL DEFAULT 0.0,
                amat REAL DEFAULT 1.0,
                created_at TEXT NOT NULL
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS access_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                address INTEGER NOT NULL,
                tag INTEGER NOT NULL,
                set_index INTEGER NOT NULL,
                hit INTEGER NOT NULL,
                evicted_address INTEGER,
                cache_line_index INTEGER NOT NULL,
                timestamp REAL NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id)
            )
        """)
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC)"
        )
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_access_log_session_id_id ON access_log(session_id, id)"
        )
        await db.commit()


async def create_session(session_id: str, config: CacheConfig):
    await flush_access_logs(force=True)
    async with get_connection() as db:
        await db.execute(
            """INSERT OR REPLACE INTO sessions 
               (session_id, mapping_type, replacement_policy, cache_size, block_size,
                associativity, address_bits, total_accesses, hits, misses,
                hit_rate, miss_rate, amat, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0.0, 0.0, 1.0, datetime('now'))""",
            (
                session_id,
                config.mapping_type.value,
                config.replacement_policy.value,
                config.cache_size,
                config.block_size,
                config.associativity,
                config.address_bits,
            ),
        )
        await db.commit()


async def log_access(
    session_id: str,
    address: int,
    tag: int,
    set_index: int,
    hit: bool,
    evicted_address: Optional[int],
    cache_line_index: int,
):
    async with _access_log_lock:
        _pending_access_logs.append(
            (
                session_id,
                address,
                tag,
                set_index,
                1 if hit else 0,
                evicted_address,
                cache_line_index,
                time.time(),
            )
        )
    await flush_access_logs(force=False)


async def update_session_stats(
    session_id: str,
    total_accesses: int,
    hits: int,
    misses: int,
    hit_rate: float,
    miss_rate: float,
    amat: float,
):
    await flush_access_logs(force=True)
    async with get_connection() as db:
        await db.execute(
            """UPDATE sessions SET total_accesses=?, hits=?, misses=?,
               hit_rate=?, miss_rate=?, amat=? WHERE session_id=?""",
            (total_accesses, hits, misses, hit_rate, miss_rate, amat, session_id),
        )
        await db.commit()


async def get_session(session_id: str) -> Optional[Dict]:
    await flush_access_logs(force=True)
    async with get_connection() as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM sessions WHERE session_id=?", (session_id,)
        )
        row = await cursor.fetchone()
        if row:
            return dict(row)
        return None


async def list_sessions() -> List[SessionSummary]:
    await flush_access_logs(force=True)
    async with get_connection() as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM sessions ORDER BY created_at DESC LIMIT 50"
        )
        rows = await cursor.fetchall()
        results = []
        for row in rows:
            r = dict(row)
            results.append(
                SessionSummary(
                    session_id=r["session_id"],
                    mapping_type=r["mapping_type"],
                    replacement_policy=r["replacement_policy"],
                    total_accesses=r["total_accesses"],
                    hits=r["hits"],
                    misses=r["misses"],
                    hit_rate=r["hit_rate"],
                    miss_rate=r["miss_rate"],
                    amat=r["amat"],
                    created_at=r["created_at"],
                )
            )
        return results


async def export_session_csv(session_id: str) -> Optional[str]:
    await flush_access_logs(force=True)
    async with get_connection() as db:
        db.row_factory = aiosqlite.Row
        session_cursor = await db.execute(
            "SELECT * FROM sessions WHERE session_id=?", (session_id,)
        )
        session = await session_cursor.fetchone()
        if not session:
            return None

        s = dict(session)
        lines = [
            f"# Session: {s['session_id']}",
            f"# Mapping: {s['mapping_type']}, Policy: {s['replacement_policy']}",
            f"# Cache Size: {s['cache_size']}, Block Size: {s['block_size']}, Associativity: {s['associativity']}",
            f"# Total: {s['total_accesses']}, Hits: {s['hits']}, Misses: {s['misses']}",
            f"# Hit Rate: {s['hit_rate']}, Miss Rate: {s['miss_rate']}, AMAT: {s['amat']}",
            "",
            "address,tag,set_index,hit,evicted_address,cache_line_index,timestamp",
        ]

        cursor = await db.execute(
            "SELECT * FROM access_log WHERE session_id=? ORDER BY id", (session_id,)
        )
        rows = await cursor.fetchall()
        for row in rows:
            r = dict(row)
            evicted = r["evicted_address"] if r["evicted_address"] is not None else ""
            lines.append(
                f"{r['address']},{r['tag']},{r['set_index']},{r['hit']},{evicted},{r['cache_line_index']},{r['timestamp']}"
            )

        return "\n".join(lines)
