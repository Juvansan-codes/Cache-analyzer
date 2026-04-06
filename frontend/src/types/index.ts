export type MappingType = 'direct' | 'set_associative' | 'fully_associative';
export type ReplacementPolicy = 'lru' | 'fifo' | 'random';
export type CacheLineStatus = 'empty' | 'hit' | 'miss' | 'evicted';
export type TracePattern = 'sequential' | 'random' | 'loop' | 'spatial';

export interface CacheConfig {
  cache_size: number;
  block_size: number;
  associativity: number;
  mapping_type: MappingType;
  replacement_policy: ReplacementPolicy;
  address_bits: number;
}

export interface CacheLine {
  index: number;
  valid: boolean;
  tag: number | null;
  data: number | null;
  status: CacheLineStatus;
  access_count: number;
  last_access: number;
}

export interface AccessResult {
  address: number;
  tag: number;
  index: number;
  hit: boolean;
  evicted_address: number | null;
  cache_line_index: number;
  set_index: number | null;
}

export interface CacheState {
  lines: CacheLine[];
  total_accesses: number;
  hits: number;
  misses: number;
  hit_rate: number;
  miss_rate: number;
  amat: number;
}

export interface CacheUpdateEvent {
  event: 'cache_update' | 'cache_reset' | 'connected';
  access?: AccessResult;
  state: CacheState;
  session_id: string;
  timestamp?: number;
}

export interface TraceConfig {
  pattern: TracePattern;
  count: number;
  address_range: number;
}

export interface SessionSummary {
  session_id: string;
  mapping_type: string;
  replacement_policy: string;
  total_accesses: number;
  hits: number;
  misses: number;
  hit_rate: number;
  miss_rate: number;
  amat: number;
  created_at: string;
}

export interface AccessLogEntry {
  address: number;
  tag: number;
  index: number;
  hit: boolean;
  evicted_address: number | null;
  cache_line_index: number;
  timestamp: number;
}

export interface HeatmapCell {
  x: number;
  y: number;
  address: number;
  count: number;
}
