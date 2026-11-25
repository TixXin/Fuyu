import type { ReactNode } from "react";
import type { TimerLayout } from "./timerLayout.ts";

const box = (x: number, y: number, w: number, h: number, r = 2, o = 0.22) => (
  <rect x={x} y={y} width={w} height={h} rx={r} fill="currentColor" opacity={o} />
);

const SHAPES: Record<TimerLayout, ReactNode> = {
  split: (
    <>
      {box(5, 6, 22, 5, 2, 0.34)}
      {[14, 23].map((y) => [5, 13, 21].map((x) => <rect key={`${x}-${y}`} x={x} y={y} width={6} height={7} rx={1.5} fill="currentColor" opacity={0.22} />))}
      {box(5, 32, 22, 3, 1.5, 0.18)}
      {box(31, 6, 28, 29, 4, 0.14)}
      <circle cx={45} cy={20.5} r={8.5} fill="none" stroke="currentColor" strokeWidth={2.2} opacity={0.24} />
      <path d="M45 12 A8.5 8.5 0 1 1 37.5 24.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" opacity={0.78} />
    </>
  ),
  dial: (
    <>
      {box(5, 5, 18, 5, 2.5, 0.3)}
      {box(37, 5, 22, 5, 2.5, 0.18)}
      {box(5, 13, 54, 22, 4, 0.14)}
      {box(18, 17, 28, 7, 2.5, 0.65)}
      {box(14, 27, 36, 2.2, 1.1, 0.35)}
      {box(25, 31, 14, 2.5, 1.2, 0.55)}
    </>
  ),
  grid: (
    <>
      {box(5, 5, 42, 5, 2, 0.28)}
      {box(49, 5, 10, 5, 2.5, 0.22)}
      {[13, 25].map((y) => [5, 24, 43].map((x, idx) => (
        <g key={`${x}-${y}`}>
          {box(x, y, 16, 10, 2.5, y === 13 && idx === 0 ? 0.34 : 0.16)}
          {box(x + 2.5, y + 4.5, 9, 2.5, 1, y === 13 && idx === 0 ? 0.72 : 0.42)}
        </g>
      )))}
    </>
  ),
  hub: (
    <>
      {box(5, 6, 33, 5, 2, 0.28)}
      {box(5, 13, 33, 4, 1.8, 0.18)}
      {box(5, 19, 33, 16, 3.5, 0.15)}
      {box(9, 24, 15, 4, 1.5, 0.55)}
      {box(41, 6, 18, 29, 3.5, 0.2)}
      {box(44, 10, 12, 2.4, 1.2, 0.52)}
      {box(44, 16, 12, 5, 1.6, 0.3)}
      {box(44, 23, 12, 5, 1.6, 0.24)}
    </>
  ),
};

export function TimerLayoutGlyph({ layout }: { layout: TimerLayout }) {
  return (
    <svg viewBox="0 0 64 40" width="64" height="40" aria-hidden="true">
      {SHAPES[layout]}
    </svg>
  );
}
