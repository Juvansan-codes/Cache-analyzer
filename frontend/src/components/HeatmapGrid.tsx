import React, { useMemo } from 'react';
import { useCacheStore } from '../store/cacheStore';

export default function HeatmapGrid() {
  const heatmap = useCacheStore((s) => s.heatmap);

  const gridSize = 16;
  const totalCells = gridSize * gridSize;

  const { cells, maxCount } = useMemo(() => {
    let max = 0;
    const cellData: { address: number; count: number; x: number; y: number }[] = [];

    for (let i = 0; i < totalCells; i++) {
      const count = heatmap[i] || 0;
      if (count > max) max = count;
      cellData.push({
        address: i,
        count,
        x: i % gridSize,
        y: Math.floor(i / gridSize),
      });
    }

    return { cells: cellData, maxCount: max };
  }, [heatmap]);

  const getColor = (count: number): string => {
    if (count === 0) return 'rgba(30, 41, 59, 0.8)';
    const intensity = maxCount > 0 ? count / maxCount : 0;
    if (intensity < 0.25) return `rgba(59, 130, 246, ${0.2 + intensity * 2})`;
    if (intensity < 0.5) return `rgba(99, 102, 241, ${0.3 + intensity * 1.4})`;
    if (intensity < 0.75) return `rgba(168, 85, 247, ${0.4 + intensity * 0.8})`;
    return `rgba(236, 72, 153, ${0.5 + intensity * 0.5})`;
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" />
          Memory Heatmap
        </h2>
        <span className="text-xs text-slate-500 font-mono">
          {gridSize}×{gridSize} (0–{totalCells - 1})
        </span>
      </div>

      <div
        className="grid gap-[2px]"
        style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
      >
        {cells.map((cell) => (
          <div
            key={cell.address}
            className="aspect-square rounded-[3px] transition-all duration-300 hover:scale-150 hover:z-10 relative group cursor-crosshair"
            style={{ backgroundColor: getColor(cell.count) }}
          >
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-[10px] font-mono text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 shadow-xl">
              addr: {cell.address} | hits: {cell.count}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800">
        <span className="text-[10px] text-slate-500">Cold</span>
        <div className="flex-1 mx-3 h-2 rounded-full overflow-hidden flex">
          <div className="flex-1 bg-blue-500/40" />
          <div className="flex-1 bg-indigo-500/60" />
          <div className="flex-1 bg-purple-500/70" />
          <div className="flex-1 bg-pink-500/90" />
        </div>
        <span className="text-[10px] text-slate-500">Hot</span>
      </div>
    </div>
  );
}
