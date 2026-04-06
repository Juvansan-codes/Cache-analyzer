import React from 'react';
import { useCacheStore } from '../store/cacheStore';

export default function MetricsPanel() {
  const state = useCacheStore((s) => s.state);

  const metrics = [
    {
      label: 'Total Accesses',
      value: state.total_accesses,
      icon: '⚡',
      color: 'from-blue-500/20 to-blue-600/5 border-blue-500/30',
      textColor: 'text-blue-400',
    },
    {
      label: 'Cache Hits',
      value: state.hits,
      icon: '✓',
      color: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/30',
      textColor: 'text-emerald-400',
    },
    {
      label: 'Cache Misses',
      value: state.misses,
      icon: '✗',
      color: 'from-red-500/20 to-red-600/5 border-red-500/30',
      textColor: 'text-red-400',
    },
    {
      label: 'Hit Rate',
      value: `${(state.hit_rate * 100).toFixed(1)}%`,
      icon: '◎',
      color: 'from-purple-500/20 to-purple-600/5 border-purple-500/30',
      textColor: 'text-purple-400',
    },
    {
      label: 'Miss Rate',
      value: `${(state.miss_rate * 100).toFixed(1)}%`,
      icon: '◉',
      color: 'from-amber-500/20 to-amber-600/5 border-amber-500/30',
      textColor: 'text-amber-400',
    },
    {
      label: 'AMAT',
      value: `${state.amat.toFixed(2)} cy`,
      icon: '⏱',
      color: 'from-cyan-500/20 to-cyan-600/5 border-cyan-500/30',
      textColor: 'text-cyan-400',
    },
  ];

  return (
    <div className="bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-800 p-6">
      <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
        Performance Metrics
      </h2>

      <div className="grid grid-cols-3 gap-3">
        {metrics.map((m) => (
          <div
            key={m.label}
            className={`rounded-xl border bg-gradient-to-br p-4 transition-all duration-300 hover:scale-[1.02] ${m.color}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">{m.icon}</span>
              <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">
                {m.label}
              </span>
            </div>
            <div className={`text-2xl font-bold font-mono ${m.textColor}`}>
              {m.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-800">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
          <span>Hit / Miss Ratio</span>
          <span className="font-mono">
            {state.hits} / {state.misses}
          </span>
        </div>
        <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500 rounded-l-full"
            style={{ width: `${state.hit_rate * 100}%` }}
          />
          <div
            className="h-full bg-gradient-to-r from-red-500 to-red-400 transition-all duration-500 rounded-r-full"
            style={{ width: `${state.miss_rate * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
