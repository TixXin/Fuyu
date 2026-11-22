import type { ReactNode } from "react";
import type { MessageLayout } from "../feed/messageLayout";

const box = (x: number, y: number, w: number, h: number, r = 2, o = 0.22) => <rect x={x} y={y} width={w} height={h} rx={r} fill="currentColor" opacity={o} />;
const dot = (cx: number, cy: number, r = 2.6, o = 0.55) => <circle cx={cx} cy={cy} r={r} fill="currentColor" opacity={o} />;

const SHAPES: Record<MessageLayout, ReactNode> = {
  focus: <>{box(6, 6, 52, 2, 1, 0.5)}{box(6, 11, 52, 23, 5)}{box(11, 16, 22, 3, 1.5, 0.6)}{box(11, 22, 34, 2.4, 1.2, 0.4)}{box(11, 28, 10, 3.6, 1.8, 0.7)}</>,
  inbox: <>{[7, 17, 27].map((y) => <g key={y}>{dot(10, y + 3)}{box(16, y + 0.5, 30, 2.4, 1.2, 0.5)}{box(16, y + 4.2, 40, 2, 1, 0.25)}</g>)}</>,
  reader: <>{box(5, 6, 8, 28, 3, 0.16)}{box(15, 6, 18, 28, 3, 0.26)}{box(35, 6, 24, 28, 3, 0.12)}{box(38, 10, 14, 4, 2, 0.4)}{box(17, 9, 14, 3, 1.5, 0.5)}{box(17, 15, 14, 3, 1.5, 0.35)}</>,
  stacks: <>{[[6, 7], [33, 7], [6, 23], [33, 23]].map(([x, y]) => <g key={`${x}-${y}`}>{box(x + 2, y + 9, 21, 3, 1.5, 0.12)}{box(x, y, 25, 11, 3, 0.28)}{dot(x + 4.5, y + 5.5, 2.2)}</g>)}</>,
  board: <>{[5, 25, 45].map((x) => <g key={x}>{box(x, 6, 15, 28, 3, 0.12)}{box(x + 2, 9, 11, 3, 1.5, 0.5)}{box(x + 2, 15, 11, 7, 2, 0.28)}{box(x + 2, 24, 11, 7, 2, 0.2)}</g>)}</>,
  timeline: <>{box(5, 5, 54, 5, 2.5, 0.14)}{dot(20, 7.5, 1.6, 0.7)}{dot(38, 7.5, 1.6, 0.7)}{dot(52, 7.5, 1.6, 0.7)}{box(12.4, 14, 1.2, 21, 0.6, 0.3)}{[16, 26].map((y) => <g key={y}>{dot(13, y + 2, 2.4, 0.6)}{box(19, y, 30, 5, 2.5, 0.26)}</g>)}</>,
};

export function LayoutGlyph({ layout }: { layout: MessageLayout }) {
  return <svg className="message-layout-glyph" viewBox="0 0 64 40" width="64" height="40" aria-hidden="true">{SHAPES[layout]}</svg>;
}
