import { clamp } from "./number.ts";

export type RingArc = { dashArray: string; dashOffset: number };

export function ringRadius(size: number, strokeWidth: number, index: number, gap: number) {
  const radius = (size - strokeWidth) / 2 - index * (strokeWidth + gap);
  return radius < strokeWidth / 2 ? 0 : radius;
}

export function ringArc(radius: number, strokeWidth: number, start: number, share: number, gap = 0): RingArc | null {
  const value = clamp(Number.isFinite(share) ? share : 0, 0, 1);
  if (value <= 0 || radius <= 0) return null;
  const circumference = 2 * Math.PI * radius;
  if (value >= 1 && gap === 0) return { dashArray: `${circumference} 0`, dashOffset: 0 };
  const length = Math.max(0.001, value * circumference - strokeWidth - gap);
  return {
    dashArray: `${length} ${circumference}`,
    dashOffset: -(clamp(start, 0, 1) * circumference + (strokeWidth + gap) / 2),
  };
}

export function segmentStarts(shares: readonly number[]) {
  const values = shares.map((share) => (Number.isFinite(share) ? Math.max(0, share) : 0));
  const total = values.reduce((sum, value) => sum + value, 0);
  const scale = total > 1 ? 1 / total : 1;
  let start = 0;
  return values.map((value) => {
    const segment = { start, share: value * scale };
    start += segment.share;
    return segment;
  });
}
