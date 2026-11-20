import { coverFrame, type HistoryWord } from "./historySearch";

const FRAME_ASPECT = 16 / 10;
const percent = (value: number) => `${value * 100}%`;

export function HistoryMarks({ width, height, hits }: { width: number; height: number; hits: readonly HistoryWord[] }) {
  if (hits.length === 0) return null;
  const frame = coverFrame(width, height, FRAME_ASPECT);
  return (
    <span
      className="screenshot-history__marks"
      aria-hidden="true"
      style={{ left: `${frame.left}%`, top: `${frame.top}%`, width: `${frame.width}%`, height: `${frame.height}%` }}
    >
      {hits.map((word, index) => (
        <span key={index} className="screenshot-history__mark" style={{ left: percent(word.x), top: percent(word.y), width: percent(word.width), height: percent(word.height) }} />
      ))}
    </span>
  );
}
