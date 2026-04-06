import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useCacheStore } from '../store/cacheStore';

export default function HitMissChart() {
  const comparisonData = useCacheStore((s) => s.comparisonData);
  const state = useCacheStore((s) => s.state);

  const chartData =
    comparisonData.length > 0
      ? comparisonData
      : [
          {
            name: 'Current',
            hitRate: parseFloat((state.hit_rate * 100).toFixed(1)),
            missRate: parseFloat((state.miss_rate * 100).toFixed(1)),
            amat: state.amat,
            accesses: state.total_accesses,
          },
        ];

  return (
    <div className="bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-800 p-6">
      <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        Hit/Miss Comparison
      </h2>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barGap={4} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={{ stroke: '#475569' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={{ stroke: '#475569' }}
              tickLine={false}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '12px',
                color: '#e2e8f0',
                fontSize: '12px',
              }}
              formatter={(value: number, name: string) => [
                `${value.toFixed(1)}%`,
                name === 'hitRate' ? 'Hit Rate' : 'Miss Rate',
              ]}
            />
            <Legend
              wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }}
              formatter={(value) =>
                value === 'hitRate' ? 'Hit Rate' : 'Miss Rate'
              }
            />
            <Bar
              dataKey="hitRate"
              fill="url(#greenGrad)"
              radius={[6, 6, 0, 0]}
              maxBarSize={40}
            />
            <Bar
              dataKey="missRate"
              fill="url(#redGrad)"
              radius={[6, 6, 0, 0]}
              maxBarSize={40}
            />
            <defs>
              <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
              <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f87171" />
                <stop offset="100%" stopColor="#dc2626" />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
