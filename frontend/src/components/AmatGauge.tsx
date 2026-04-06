import React from 'react';
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts';
import { useCacheStore } from '../store/cacheStore';

export default function AmatGauge() {
  const amat = useCacheStore((s) => s.state.amat);
  const missRate = useCacheStore((s) => s.state.miss_rate);

  const maxAmat = 11;
  const normalizedAmat = Math.min(amat, maxAmat);
  const percentage = (normalizedAmat / maxAmat) * 100;

  const getColor = () => {
    if (amat <= 2) return '#34d399';
    if (amat <= 4) return '#a3e635';
    if (amat <= 6) return '#facc15';
    if (amat <= 8) return '#fb923c';
    return '#ef4444';
  };

  const getLabel = () => {
    if (amat <= 2) return 'Excellent';
    if (amat <= 4) return 'Good';
    if (amat <= 6) return 'Fair';
    if (amat <= 8) return 'Poor';
    return 'Critical';
  };

  const data = [{ name: 'AMAT', value: percentage, fill: getColor() }];

  return (
    <div className="bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-800 p-6">
      <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        AMAT Gauge
      </h2>

      <div className="relative h-52 flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="85%"
            barSize={14}
            data={data}
            startAngle={225}
            endAngle={-45}
          >
            <PolarAngleAxis
              type="number"
              domain={[0, 100]}
              angleAxisId={0}
              tick={false}
            />
            <RadialBar
              background={{ fill: '#1e293b' }}
              dataKey="value"
              cornerRadius={10}
              forceCornerRadius
            />
          </RadialBarChart>
        </ResponsiveContainer>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-3xl font-bold font-mono transition-colors duration-500"
            style={{ color: getColor() }}
          >
            {amat.toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-400 font-medium mt-0.5">
            cycles
          </span>
          <span
            className="text-xs font-semibold mt-1 px-2 py-0.5 rounded-full"
            style={{
              color: getColor(),
              backgroundColor: `${getColor()}15`,
            }}
          >
            {getLabel()}
          </span>
        </div>
      </div>

      <div className="mt-2 space-y-2 text-xs">
        <div className="flex justify-between text-slate-400">
          <span>Formula</span>
          <span className="font-mono text-slate-300">
            1 + (miss_rate × 10)
          </span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Miss Rate</span>
          <span className="font-mono text-slate-300">
            {(missRate * 100).toFixed(1)}%
          </span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Hit Penalty</span>
          <span className="font-mono text-slate-300">1 cycle</span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Miss Penalty</span>
          <span className="font-mono text-slate-300">10 cycles</span>
        </div>
      </div>
    </div>
  );
}
