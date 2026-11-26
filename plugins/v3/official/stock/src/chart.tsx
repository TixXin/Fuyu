import { useState, type MouseEvent } from "react";
import { formatPercent, formatPrice, type Quote, type Trend, type TrendSeries } from "./model.ts";
import { text } from "./text.ts";
import "./chart.css";

function chartBounds(points: readonly number[], preClose: number | null): { min: number; max: number } {
  let min = points[0];
  let max = points[0];
  for (const value of points) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  if (preClose !== null && Number.isFinite(preClose)) {
    if (preClose < min) min = preClose;
    if (preClose > max) max = preClose;
  }
  if (max - min < 1e-6) {
    const pad = Math.max(Math.abs(max) * 0.005, 0.01);
    return { min: min - pad, max: max + pad };
  }
  const pad = (max - min) * 0.08;
  return { min: min - pad, max: max + pad };
}

function buildCoords(points: readonly number[], min: number, max: number, width: number, height: number, padY = 6): Array<[number, number]> {
  const span = max - min;
  const usableH = height - padY * 2;
  const stepX = points.length > 1 ? width / (points.length - 1) : 0;
  return points.map((value, index) => [
    Math.round(index * stepX * 10) / 10,
    Math.round((padY + ((max - value) / span) * usableH) * 10) / 10,
  ]);
}

function linePath(coords: readonly [number, number][]): string {
  return coords.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x} ${y}`).join(" ");
}

function areaPath(coords: readonly [number, number][], height: number): string {
  if (coords.length < 2) return "";
  const first = coords[0];
  const last = coords[coords.length - 1];
  return `${linePath(coords)} L${last[0]} ${height} L${first[0]} ${height} Z`;
}

export function FocusChart({
  series,
  quote,
  trend,
  gradId,
}: {
  series: TrendSeries | undefined;
  quote: Quote | undefined;
  trend: Trend;
  gradId: string;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const points = series?.points ?? [];
  const preClose = series?.preClose ?? quote?.preClose ?? null;

  if (points.length >= 2) {
    const width = 320;
    const height = 84;
    const { min, max } = chartBounds(points, preClose);
    const coords = buildCoords(points, min, max, width, height);
    const rawMin = Math.min(...points);
    const rawMax = Math.max(...points);
    const refY =
      preClose !== null && Number.isFinite(preClose)
        ? Math.round((6 + ((max - preClose) / (max - min)) * (height - 12)) * 10) / 10
        : null;
    const last = coords[coords.length - 1];
    const safeHover = hoverIdx !== null && hoverIdx >= 0 && hoverIdx < points.length ? hoverIdx : null;
    const hoverCoord = safeHover !== null ? coords[safeHover] : null;
    const hoverVal = safeHover !== null ? points[safeHover] : null;
    const hoverPct = hoverVal !== null && preClose && preClose > 0 ? ((hoverVal - preClose) / preClose) * 100 : null;
    const alignRight = hoverCoord !== null && hoverCoord[0] > width * 0.65;

    const handleMove = (event: MouseEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      setHoverIdx(Math.round(ratio * (points.length - 1)));
    };

    return (
      <div
        className={`fuyu-stock__chart is-${trend}`}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <svg className="fuyu-stock__svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.26" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.01" />
            </linearGradient>
          </defs>
          {refY !== null && (
            <line
              className="fuyu-stock__refline"
              x1="0"
              x2={width}
              y1={refY}
              y2={refY}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          )}
          <path d={areaPath(coords, height)} fill={`url(#${gradId})`} />
          <path className="fuyu-stock__stroke" d={linePath(coords)} fill="none" vectorEffect="non-scaling-stroke" />
          <circle className="fuyu-stock__end-dot" cx={last[0]} cy={last[1]} r="2.8" />
          {hoverCoord && (
            <>
              <line
                className="fuyu-stock__crosshair"
                x1={hoverCoord[0]}
                x2={hoverCoord[0]}
                y1="0"
                y2={height}
                strokeDasharray="2 2"
                vectorEffect="non-scaling-stroke"
              />
              <circle className="fuyu-stock__end-dot" cx={hoverCoord[0]} cy={hoverCoord[1]} r="3.4" />
            </>
          )}
        </svg>
        <span className="fuyu-stock__chart-hi">{formatPrice(rawMax)}</span>
        <span className="fuyu-stock__chart-lo">{formatPrice(rawMin)}</span>
        {preClose !== null && <span className="fuyu-stock__chart-ref">{`${text.preClose} ${formatPrice(preClose)}`}</span>}
        {hoverCoord && hoverVal !== null && (
          <span
            className={alignRight ? "fuyu-stock__chart-tip is-right" : "fuyu-stock__chart-tip"}
            style={{ left: `${(hoverCoord[0] / width) * 100}%` }}
          >
            {hoverPct !== null ? `${formatPrice(hoverVal)} (${formatPercent(hoverPct)})` : formatPrice(hoverVal)}
          </span>
        )}
      </div>
    );
  }

  const low = quote?.low ?? null;
  const high = quote?.high ?? null;
  const price = quote?.price ?? null;
  const pos =
    low !== null && high !== null && price !== null && high > low
      ? Math.max(0, Math.min(100, ((price - low) / (high - low)) * 100))
      : 50;

  return (
    <div className={`fuyu-stock__range-fallback is-${trend}`}>
      <div className="fuyu-stock__range-head">
        <span>{text.dayRange}</span>
        <span>{low !== null && high !== null ? `${formatPrice(low)} – ${formatPrice(high)}` : "--"}</span>
      </div>
      <div className="fuyu-stock__range-track">
        <span className="fuyu-stock__range-fill" style={{ width: `${pos}%` }} />
        <span className="fuyu-stock__range-thumb" style={{ left: `${pos}%` }} />
      </div>
    </div>
  );
}

export function MiniSpark({ series, trend }: { series: TrendSeries | undefined; trend: Trend }) {
  const points = series?.points ?? [];
  if (points.length < 2) return null;
  const width = 44;
  const height = 16;
  const { min, max } = chartBounds(points, series?.preClose ?? null);
  const coords = buildCoords(points, min, max, width, height, 2);
  return (
    <svg className={`fuyu-stock__mini-spark is-${trend}`} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={linePath(coords)} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AreaSpark({
  series,
  trend,
  gradId,
  height = 24,
}: {
  series: TrendSeries | undefined;
  trend: Trend;
  gradId: string;
  height?: number;
}) {
  const points = series?.points ?? [];
  if (points.length < 2) return <div className="fuyu-stock__area-empty" style={{ height }} aria-hidden="true" />;
  const width = 180;
  const { min, max } = chartBounds(points, series?.preClose ?? null);
  const coords = buildCoords(points, min, max, width, height, 3);
  return (
    <svg
      className={`fuyu-stock__area-spark is-${trend}`}
      style={{ height }}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={areaPath(coords, height)} fill={`url(#${gradId})`} />
      <path d={linePath(coords)} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
