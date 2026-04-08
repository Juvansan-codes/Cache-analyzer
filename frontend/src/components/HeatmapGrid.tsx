import React, { useMemo } from 'react';
import { useCacheStore } from '../store/cacheStore';

interface HeatmapGridProps {
  addressBits: number;
}

const MAX_RENDER_CELLS = 4096;

export default function HeatmapGrid({ addressBits }: HeatmapGridProps) {
  const heatmap = useCacheStore((s) => s.heatmap);

  const addressSpaceSize = Math.pow(2, addressBits);
  const bucketCount = Math.min(addressSpaceSize, MAX_RENDER_CELLS);
  const bucketWidth = Math.max(1, Math.ceil(addressSpaceSize / bucketCount));
  const gridSize = Math.ceil(Math.sqrt(bucketCount));

  const { cells, maxCount } = useMemo(() => {
    let max = 0;
    const bucketHits = new Array<number>(bucketCount).fill(0);

    for (const [addrKey, count] of Object.entries(heatmap)) {
      const addr = Number(addrKey);
      if (!Number.isFinite(addr) || addr < 0 || addr >= addressSpaceSize) {
        continue;
      }

      const bucketIndex = Math.min(bucketCount - 1, Math.floor(addr / bucketWidth));
      bucketHits[bucketIndex] += count;
      if (bucketHits[bucketIndex] > max) {
        max = bucketHits[bucketIndex];
      }
    }

    const cellData: {
      bucketStart: number;
      bucketEnd: number;
      count: number;
      x: number;
      y: number;
    }[] = [];

    for (let i = 0; i < bucketCount; i++) {
      const bucketStart = i * bucketWidth;
      const bucketEnd = Math.min(addressSpaceSize - 1, ((i + 1) * bucketWidth) - 1);
      cellData.push({
        bucketStart,
        bucketEnd,
        count: bucketHits[i],
        x: i % gridSize,
        y: Math.floor(i / gridSize),
      });
    }

    return { cells: cellData, maxCount: max };
  }, [heatmap, addressSpaceSize, bucketCount, bucketWidth, gridSize]);

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
          {gridSize}x{gridSize} buckets={bucketCount} range=0-{addressSpaceSize - 1}
        </span>
      </div>

      <div className="rounded-lg overflow-hidden border border-slate-800/70 bg-slate-950/40">
        <svg
          className="w-full aspect-square"
          viewBox={`0 0 ${gridSize} ${gridSize}`}
          preserveAspectRatio="none"
        >
          {cells.map((cell) => (
            <rect
              key={cell.bucketStart}
              x={cell.x}
              y={cell.y}
              width={1}
              height={1}
              fill={getColor(cell.count)}
            >
              <title>{`addr: ${cell.bucketStart}-${cell.bucketEnd} | hits: ${cell.count}`}</title>
            </rect>
          ))}
        </svg>
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
