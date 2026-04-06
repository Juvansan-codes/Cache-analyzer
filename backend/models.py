from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from enum import Enum


class MappingType(str, Enum):
    DIRECT = "direct"
    SET_ASSOCIATIVE = "set_associative"
    FULLY_ASSOCIATIVE = "fully_associative"


class ReplacementPolicy(str, Enum):
    LRU = "lru"
    FIFO = "fifo"
    RANDOM = "random"


class CacheConfig(BaseModel):
    cache_size: int = Field(default=8, ge=2, le=64)
    block_size: int = Field(default=1, ge=1, le=16)
    associativity: int = Field(default=2, ge=1, le=16)
    mapping_type: MappingType = MappingType.DIRECT
    replacement_policy: ReplacementPolicy = ReplacementPolicy.LRU
    address_bits: int = Field(default=8, ge=4, le=32)


class CacheLine(BaseModel):
    index: int
    valid: bool = False
    tag: Optional[int] = None
    data: Optional[int] = None
    status: Literal["empty", "hit", "miss", "evicted"] = "empty"
    access_count: int = 0
    last_access: int = 0


class AccessResult(BaseModel):
    address: int
    tag: int
    index: int
    hit: bool
    evicted_address: Optional[int] = None
    cache_line_index: int
    set_index: Optional[int] = None


class CacheState(BaseModel):
    lines: List[CacheLine]
    total_accesses: int = 0
    hits: int = 0
    misses: int = 0
    hit_rate: float = 0.0
    miss_rate: float = 0.0
    amat: float = 1.0


class CacheUpdateEvent(BaseModel):
    event: str = "cache_update"
    access: AccessResult
    state: CacheState
    session_id: str
    timestamp: float


class SessionConfig(BaseModel):
    session_id: str
    config: CacheConfig


class SessionSummary(BaseModel):
    session_id: str
    mapping_type: str
    replacement_policy: str
    total_accesses: int
    hits: int
    misses: int
    hit_rate: float
    miss_rate: float
    amat: float
    created_at: str


class HeatmapCell(BaseModel):
    address: int
    count: int


class TraceConfig(BaseModel):
    pattern: Literal["sequential", "random", "loop", "spatial"] = "random"
    count: int = Field(default=50, ge=1, le=1000)
    address_range: int = Field(default=256, ge=16, le=65536)
