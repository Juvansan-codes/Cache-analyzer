import React, { useState } from 'react';
import { useCacheStore } from '../store/cacheStore';
import { MappingType, ReplacementPolicy, TracePattern, CacheConfig } from '../types';

interface ControlPanelProps {
  onCreateSession: (config: CacheConfig) => void;
  onRunTrace: (pattern: TracePattern, count: number) => void;
  onStartSerial: () => void;
  onStopSerial: () => void;
  onReset: () => void;
  onExport: () => void;
  onManualAccess: (address: number) => void;
  onSaveComparison: () => void;
}

export default function ControlPanel({
  onCreateSession,
  onRunTrace,
  onStartSerial,
  onStopSerial,
  onReset,
  onExport,
  onManualAccess,
  onSaveComparison,
}: ControlPanelProps) {
  const config = useCacheStore((s) => s.config);
  const setConfig = useCacheStore((s) => s.setConfig);
  const sessionId = useCacheStore((s) => s.sessionId);
  const isConnected = useCacheStore((s) => s.isConnected);
  const isRunning = useCacheStore((s) => s.isRunning);
  const clearComparison = useCacheStore((s) => s.clearComparison);

  const [tracePattern, setTracePattern] = useState<TracePattern>('random');
  const [traceCount, setTraceCount] = useState(50);
  const [manualAddr, setManualAddr] = useState('');

  const handleCreate = () => {
    onCreateSession(config);
  };

  const handleManualAccess = () => {
    const addr = parseInt(manualAddr, 10);
    if (!isNaN(addr) && addr >= 0) {
      onManualAccess(addr);
      setManualAddr('');
    }
  };

  const selectClass =
    'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all appearance-none cursor-pointer';

  const inputClass =
    'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all';

  const btnPrimary =
    'w-full py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-95';

  return (
    <div className="bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-800 p-6 space-y-5">
      <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
        Control Panel
      </h2>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-slate-400 font-medium mb-1 uppercase tracking-wide">
              Mapping Type
            </label>
            <select
              className={selectClass}
              value={config.mapping_type}
              onChange={(e) => setConfig({ mapping_type: e.target.value as MappingType })}
            >
              <option value="direct">Direct Mapped</option>
              <option value="set_associative">Set Associative</option>
              <option value="fully_associative">Fully Associative</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 font-medium mb-1 uppercase tracking-wide">
              Replacement Policy
            </label>
            <select
              className={selectClass}
              value={config.replacement_policy}
              onChange={(e) => setConfig({ replacement_policy: e.target.value as ReplacementPolicy })}
            >
              <option value="lru">LRU</option>
              <option value="fifo">FIFO</option>
              <option value="random">Random</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] text-slate-400 font-medium mb-1 uppercase tracking-wide">
              Cache Size
            </label>
            <select
              className={selectClass}
              value={config.cache_size}
              onChange={(e) => setConfig({ cache_size: parseInt(e.target.value) })}
            >
              {[4, 8, 16, 32].map((s) => (
                <option key={s} value={s}>
                  {s} lines
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 font-medium mb-1 uppercase tracking-wide">
              Block Size
            </label>
            <select
              className={selectClass}
              value={config.block_size}
              onChange={(e) => setConfig({ block_size: parseInt(e.target.value) })}
            >
              {[1, 2, 4, 8].map((s) => (
                <option key={s} value={s}>
                  {s} word{s > 1 ? 's' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 font-medium mb-1 uppercase tracking-wide">
              Associativity
            </label>
            <select
              className={selectClass}
              value={config.associativity}
              onChange={(e) => setConfig({ associativity: parseInt(e.target.value) })}
              disabled={config.mapping_type !== 'set_associative'}
            >
              {[2, 4, 8].map((s) => (
                <option key={s} value={s}>
                  {s}-way
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[11px] text-slate-400 font-medium mb-1 uppercase tracking-wide">
            Address Bits
          </label>
          <select
            className={selectClass}
            value={config.address_bits}
            onChange={(e) => setConfig({ address_bits: parseInt(e.target.value) })}
          >
            {[8, 12, 16, 20, 24].map((s) => (
              <option key={s} value={s}>
                {s} bits ({Math.pow(2, s)} addresses)
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleCreate}
          className={`${btnPrimary} bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20`}
        >
          {sessionId ? '⟲ New Session' : '⚡ Create Session'}
        </button>
      </div>

      {sessionId && (
        <>
          <div className="border-t border-slate-800 pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-red-400'} animate-pulse`} />
              <span className="text-xs text-slate-400">
                Session: <span className="font-mono text-slate-200">{sessionId}</span>
              </span>
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] text-slate-400 font-medium uppercase tracking-wide">
                Manual Access
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  className={inputClass}
                  placeholder="Address"
                  value={manualAddr}
                  onChange={(e) => setManualAddr(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualAccess()}
                />
                <button
                  onClick={handleManualAccess}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-all active:scale-95"
                >
                  Send
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-4 space-y-3">
            <label className="block text-[11px] text-slate-400 font-medium uppercase tracking-wide">
              Trace Generator
            </label>

            <div className="grid grid-cols-2 gap-3">
              <select
                className={selectClass}
                value={tracePattern}
                onChange={(e) => setTracePattern(e.target.value as TracePattern)}
              >
                <option value="random">Random</option>
                <option value="sequential">Sequential</option>
                <option value="loop">Loop</option>
                <option value="spatial">Spatial</option>
              </select>

              <input
                type="number"
                className={inputClass}
                value={traceCount}
                onChange={(e) => setTraceCount(Math.min(1000, Math.max(1, parseInt(e.target.value) || 1)))}
                min={1}
                max={1000}
                placeholder="Count"
              />
            </div>

            <button
              onClick={() => onRunTrace(tracePattern, traceCount)}
              className={`${btnPrimary} bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-400 hover:to-pink-500 text-white shadow-lg shadow-purple-500/20`}
            >
              ▶ Run Trace
            </button>
          </div>

          <div className="border-t border-slate-800 pt-4 space-y-3">
            <label className="block text-[11px] text-slate-400 font-medium uppercase tracking-wide">
              Serial / Mock Input
            </label>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={isRunning ? onStopSerial : onStartSerial}
                className={`${btnPrimary} ${
                  isRunning
                    ? 'bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-400 hover:to-orange-500'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500'
                } text-white shadow-lg`}
              >
                {isRunning ? '⏹ Stop' : '⏵ Start'} Serial
              </button>

              <button
                onClick={onReset}
                className={`${btnPrimary} bg-slate-700 hover:bg-slate-600 text-slate-200`}
              >
                ↺ Reset
              </button>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={onSaveComparison}
                className={`${btnPrimary} bg-slate-700 hover:bg-slate-600 text-slate-200`}
              >
                📊 Save to Compare
              </button>
              <button
                onClick={clearComparison}
                className={`${btnPrimary} bg-slate-700 hover:bg-slate-600 text-slate-200`}
              >
                🗑 Clear Compare
              </button>
            </div>

            <button
              onClick={onExport}
              className={`${btnPrimary} bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white shadow-lg shadow-amber-500/20`}
            >
              📥 Export CSV
            </button>
          </div>
        </>
      )}
    </div>
  );
}
