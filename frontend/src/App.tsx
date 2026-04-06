import React, { useCallback } from 'react';
import { useCacheStore } from './store/cacheStore';
import { useWebSocket } from './hooks/useWebSocket';
import CacheGrid from './components/CacheGrid';
import MetricsPanel from './components/MetricsPanel';
import HitMissChart from './components/HitMissChart';
import AmatGauge from './components/AmatGauge';
import AccessLog from './components/AccessLog';
import HeatmapGrid from './components/HeatmapGrid';
import ControlPanel from './components/ControlPanel';
import { CacheConfig, TracePattern } from './types';

const API_BASE = '/api';

export default function App() {
  const sessionId = useCacheStore((s) => s.sessionId);
  const setSessionId = useCacheStore((s) => s.setSessionId);
  const state = useCacheStore((s) => s.state);
  const config = useCacheStore((s) => s.config);
  const isConnected = useCacheStore((s) => s.isConnected);
  const setRunning = useCacheStore((s) => s.setRunning);
  const isRunning = useCacheStore((s) => s.isRunning);
  const resetState = useCacheStore((s) => s.resetState);
  const addToComparison = useCacheStore((s) => s.addToComparison);

  const { sendAccess } = useWebSocket(sessionId);

  const handleCreateSession = useCallback(
    async (cfg: CacheConfig) => {
      try {
        const res = await fetch(`${API_BASE}/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cfg),
        });
        const data = await res.json();
        resetState();
        setSessionId(data.session_id);
      } catch (err) {
        console.error('Failed to create session:', err);
      }
    },
    [setSessionId, resetState]
  );

  const handleRunTrace = useCallback(
    async (pattern: TracePattern, count: number) => {
      if (!sessionId) return;
      try {
        await fetch(`${API_BASE}/session/${sessionId}/trace`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pattern,
            count,
            address_range: Math.pow(2, config.address_bits),
          }),
        });
      } catch (err) {
        console.error('Failed to run trace:', err);
      }
    },
    [sessionId, config.address_bits]
  );

  const handleStartSerial = useCallback(async () => {
    if (!sessionId) return;
    try {
      await fetch(`${API_BASE}/session/${sessionId}/serial/start`, {
        method: 'POST',
      });
      setRunning(true);
    } catch (err) {
      console.error('Failed to start serial:', err);
    }
  }, [sessionId, setRunning]);

  const handleStopSerial = useCallback(async () => {
    if (!sessionId) return;
    try {
      await fetch(`${API_BASE}/session/${sessionId}/serial/stop`, {
        method: 'POST',
      });
      setRunning(false);
    } catch (err) {
      console.error('Failed to stop serial:', err);
    }
  }, [sessionId, setRunning]);

  const handleReset = useCallback(async () => {
    if (!sessionId) return;
    try {
      await fetch(`${API_BASE}/session/${sessionId}/reset`, {
        method: 'POST',
      });
    } catch (err) {
      console.error('Failed to reset:', err);
    }
  }, [sessionId]);

  const handleExport = useCallback(() => {
    if (!sessionId) return;
    window.open(`${API_BASE}/export/${sessionId}`, '_blank');
  }, [sessionId]);

  const handleManualAccess = useCallback(
    (address: number) => {
      sendAccess(address);
    },
    [sendAccess]
  );

  const handleSaveComparison = useCallback(() => {
    addToComparison({
      name: `${config.mapping_type.replace('_', ' ')} / ${config.replacement_policy}`,
      hitRate: parseFloat((state.hit_rate * 100).toFixed(1)),
      missRate: parseFloat((state.miss_rate * 100).toFixed(1)),
      amat: state.amat,
      accesses: state.total_accesses,
    });
  }, [addToComparison, config, state]);

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50">
        <div className="max-w-[1920px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <span className="text-xl">⚡</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                Cache Analyzer
              </h1>
              <p className="text-[11px] text-slate-500 font-medium">
                Memory Mapping &amp; Performance
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {sessionId && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
                <div
                  className={`w-2 h-2 rounded-full animate-pulse ${
                    isConnected ? 'bg-emerald-400' : 'bg-red-400'
                  }`}
                />
                <span className="text-xs font-mono text-slate-400">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            )}

            {isRunning && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-medium text-emerald-400">
                  Serial Active
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1920px] mx-auto px-6 py-6">
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-3">
            <ControlPanel
              onCreateSession={handleCreateSession}
              onRunTrace={handleRunTrace}
              onStartSerial={handleStartSerial}
              onStopSerial={handleStopSerial}
              onReset={handleReset}
              onExport={handleExport}
              onManualAccess={handleManualAccess}
              onSaveComparison={handleSaveComparison}
            />
          </div>

          <div className="col-span-9 space-y-5">
            {!sessionId ? (
              <div className="flex items-center justify-center h-[70vh]">
                <div className="text-center space-y-4 animate-fade-in">
                  <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center">
                    <span className="text-4xl">🧠</span>
                  </div>
                  <h2 className="text-2xl font-bold text-slate-200">
                    Cache Memory Analyzer
                  </h2>
                  <p className="text-slate-500 max-w-md">
                    Configure your cache parameters and create a session to start visualizing
                    memory mapping, hit/miss patterns, and performance metrics in real-time.
                  </p>
                  <div className="flex justify-center gap-3 pt-2">
                    {['Direct Mapped', 'Set Associative', 'Fully Associative'].map((t) => (
                      <span
                        key={t}
                        className="px-3 py-1 rounded-full text-xs font-medium bg-slate-800 border border-slate-700 text-slate-400"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <MetricsPanel />

                <div className="grid grid-cols-2 gap-5">
                  <CacheGrid />
                  <HeatmapGrid />
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <HitMissChart />
                  <AmatGauge />
                </div>

                <AccessLog />
              </>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-800/50 mt-8">
        <div className="max-w-[1920px] mx-auto px-6 py-4 flex items-center justify-between text-xs text-slate-600">
          <span>Cache Memory Mapping &amp; Performance Analyzer</span>
          <span className="font-mono">
            AMAT = 1 + (miss_rate × 10)
          </span>
        </div>
      </footer>
    </div>
  );
}
