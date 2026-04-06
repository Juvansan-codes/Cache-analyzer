import React, { useRef, useEffect } from 'react';
import { useCacheStore } from '../store/cacheStore';

export default function AccessLog() {
  const accessLog = useCacheStore((s) => s.accessLog);
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          Access Log
        </h2>
        <span className="text-xs text-slate-500 font-mono">
          {accessLog.length} entries
        </span>
      </div>

      <div
        ref={scrollRef}
        className="max-h-72 overflow-y-auto overflow-x-hidden space-y-1.5 scrollbar-thin"
      >
        {accessLog.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-slate-600 text-sm">
            No accesses yet. Start a trace or send addresses.
          </div>
        ) : (
          accessLog.map((entry, idx) => (
            <div
              key={`${entry.timestamp}-${idx}`}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-mono transition-all duration-200 animate-slide-up ${
                entry.hit
                  ? 'bg-emerald-500/10 border border-emerald-500/20'
                  : 'bg-red-500/10 border border-red-500/20'
              }`}
            >
              <span
                className={`flex-shrink-0 w-10 text-center text-[10px] font-bold py-0.5 rounded ${
                  entry.hit
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-red-500/20 text-red-400'
                }`}
              >
                {entry.hit ? 'HIT' : 'MISS'}
              </span>

              <span className="text-slate-400">
                addr=<span className="text-slate-200">{entry.address}</span>
              </span>

              <span className="text-slate-400">
                tag=<span className="text-slate-200">0x{entry.tag.toString(16).toUpperCase()}</span>
              </span>

              <span className="text-slate-400">
                set=<span className="text-slate-200">{entry.index}</span>
              </span>

              <span className="text-slate-400">
                line=<span className="text-slate-200">{entry.cache_line_index}</span>
              </span>

              {entry.evicted_address !== null && (
                <span className="text-yellow-400 text-[10px]">
                  evicted:{entry.evicted_address}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
