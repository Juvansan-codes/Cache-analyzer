import { create } from 'zustand';
import {
  CacheConfig,
  CacheState,
  CacheUpdateEvent,
  AccessLogEntry,
  HeatmapCell,
  MappingType,
  ReplacementPolicy,
} from '../types';

interface CacheStore {
  sessionId: string | null;
  config: CacheConfig;
  state: CacheState;
  accessLog: AccessLogEntry[];
  heatmap: Record<number, number>;
  isConnected: boolean;
  isRunning: boolean;
  comparisonData: Array<{
    name: string;
    hitRate: number;
    missRate: number;
    amat: number;
    accesses: number;
  }>;

  setSessionId: (id: string) => void;
  setConfig: (config: Partial<CacheConfig>) => void;
  setConnected: (connected: boolean) => void;
  setRunning: (running: boolean) => void;
  updateFromEvent: (event: CacheUpdateEvent) => void;
  addToComparison: (entry: {
    name: string;
    hitRate: number;
    missRate: number;
    amat: number;
    accesses: number;
  }) => void;
  clearComparison: () => void;
  resetState: () => void;
}

const defaultConfig: CacheConfig = {
  cache_size: 8,
  block_size: 1,
  associativity: 2,
  mapping_type: 'direct',
  replacement_policy: 'lru',
  address_bits: 8,
};

const defaultState: CacheState = {
  lines: Array.from({ length: 8 }, (_, i) => ({
    index: i,
    valid: false,
    tag: null,
    data: null,
    status: 'empty' as const,
    access_count: 0,
    last_access: 0,
  })),
  total_accesses: 0,
  hits: 0,
  misses: 0,
  hit_rate: 0,
  miss_rate: 0,
  amat: 1.0,
};

export const useCacheStore = create<CacheStore>((set, get) => ({
  sessionId: null,
  config: { ...defaultConfig },
  state: { ...defaultState },
  accessLog: [],
  heatmap: {},
  isConnected: false,
  isRunning: false,
  comparisonData: [],

  setSessionId: (id) => set({ sessionId: id }),

  setConfig: (partial) =>
    set((s) => ({ config: { ...s.config, ...partial } })),

  setConnected: (connected) => set({ isConnected: connected }),

  setRunning: (running) => set({ isRunning: running }),

  updateFromEvent: (event) => {
    set((s) => {
      const newState = event.state;

      if (event.event === 'cache_reset') {
        return {
          state: newState,
          accessLog: [],
          heatmap: {},
        };
      }

      const newLog = event.access
        ? [
            {
              address: event.access.address,
              tag: event.access.tag,
              index: event.access.index,
              hit: event.access.hit,
              evicted_address: event.access.evicted_address,
              cache_line_index: event.access.cache_line_index,
              timestamp: event.timestamp || Date.now(),
            },
            ...s.accessLog.slice(0, 99),
          ]
        : s.accessLog;

      const newHeatmap = { ...s.heatmap };
      if (event.access) {
        const addr = event.access.address;
        newHeatmap[addr] = (newHeatmap[addr] || 0) + 1;
      }

      return {
        state: newState,
        accessLog: newLog,
        heatmap: newHeatmap,
      };
    });
  },

  addToComparison: (entry) =>
    set((s) => ({
      comparisonData: [...s.comparisonData.slice(-9), entry],
    })),

  clearComparison: () => set({ comparisonData: [] }),

  resetState: () =>
    set({
      state: { ...defaultState },
      accessLog: [],
      heatmap: {},
    }),
}));
