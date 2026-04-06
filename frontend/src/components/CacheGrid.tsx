import React, { useEffect, useRef } from 'react';
import { useCacheStore } from '../store/cacheStore';
import { CacheLineStatus } from '../types';

const statusColors: Record<CacheLineStatus, string> = {
  empty: 'bg-slate-700 border-slate-600',
  hit: 'bg-emerald-500/20 border-emerald-400',
  miss: 'bg-red-500/20 border-red-400',
  evicted: 'bg-yellow-500/20 border-yellow-400',
};

const statusGlow: Record<CacheLineStatus, string> = {
  empty: '',
  hit: 'animate-flash-green',
  miss: 'animate-flash-red',
  evicted: 'animate-flash-yellow',
};

const statusLabel: Record<CacheLineStatus, string> = {
  empty: 'EMPTY',
  hit: 'HIT',
  miss: 'MISS',
  evicted: 'EVICT',
};

const statusDot: Record<CacheLineStatus, string> = {
  empty: 'bg-slate-500',
  hit: 'bg-emerald-400',
  miss: 'bg-red-400',
  evicted: 'bg-yellow-400',
};

export default function CacheGrid() {
  const state = useCacheStore((s) => s.state);
  const config = useCacheStore((s) => s.config);
  const prevStatusRef = useRef<Map<number, string>>(new Map());

  const lines = state.lines.slice(0, config.cache_size);

  return (
    <div className="bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-800 p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          Cache Memory
        </h2>
        <span className="text-xs font-mono text-slate-500">
          {config.cache_size} lines · {config.mapping_type.replace('_', ' ')}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {lines.map((line, idx) => {
          const prevStatus = prevStatusRef.current.get(line.index);
          const isNewStatus = prevStatus !== line.status;

          if (isNewStatus) {
            prevStatusRef.current.set(line.index, line.status);
          }

          return (
            <div
              key={line.index}
              className={`
                relative rounded-xl border-2 p-3 transition-all duration-300
                ${statusColors[line.status]}
                ${isNewStatus && line.status !== 'empty' ? statusGlow[line.status] : ''}
              `}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono text-slate-400 font-medium">
                  #{line.index}
                </span>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${statusDot[line.status]}`} />
                  <span className={`text-[9px] font-bold tracking-wider ${
                    line.status === 'hit'
                      ? 'text-emerald-400'
                      : line.status === 'miss'
                      ? 'text-red-400'
                      : line.status === 'evicted'
                      ? 'text-yellow-400'
                      : 'text-slate-500'
                  }`}>
                    {statusLabel[line.status]}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-500">Tag</span>
                  <span className="text-xs font-mono text-slate-200 font-medium">
                    {line.valid && line.tag !== null ? `0x${line.tag.toString(16).toUpperCase()}` : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-500">Data</span>
                  <span className="text-xs font-mono text-slate-200 font-medium">
                    {line.valid && line.data !== null ? line.data : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-500">Hits</span>
                  <span className="text-xs font-mono text-slate-200 font-medium">
                    {line.access_count}
                  </span>
                </div>
              </div>

              {line.valid && (
                <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-cyan-500 border-2 border-slate-900" />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-6 mt-5 pt-4 border-t border-slate-800">
        {[
          { label: 'HIT', color: 'bg-emerald-400' },
          { label: 'MISS', color: 'bg-red-400' },
          { label: 'EVICT', color: 'bg-yellow-400' },
          { label: 'EMPTY', color: 'bg-slate-500' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-sm ${item.color}`} />
            <span className="text-[10px] text-slate-400 font-medium">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
