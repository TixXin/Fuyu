import { GRID_UNIT_PX } from "../../../lib/settings/customPanels.ts";

export type SnapBox = { left: number; top: number; width: number; height: number };
export type Snapped = SnapBox & { guideX: number | null; guideY: number | null };
type Pull = { value: number; guide: number };

export const FREE_DOT_PX = 16;
const PULL_PX = 8;
const GAP_PX = GRID_UNIT_PX;

const toDots = (value: number) => Math.round(value / FREE_DOT_PX) * FREE_DOT_PX;
const within = (value: number, low: number, high: number) => Math.min(Math.max(value, low), Math.max(low, high));

function closest(value: number, pulls: readonly Pull[]): Pull | null {
  let best: Pull | null = null;
  for (const pull of pulls) {
    const distance = Math.abs(pull.value - value);
    if (distance <= PULL_PX && (!best || distance < Math.abs(best.value - value))) best = pull;
  }
  return best;
}

function startPulls(starts: readonly number[], ends: readonly number[], size: number): Pull[] {
  return [
    ...starts.map((start) => ({ value: start, guide: start })),
    ...ends.map((end) => ({ value: end - size, guide: end })),
    ...ends.map((end) => ({ value: end + GAP_PX, guide: end + GAP_PX })),
    ...starts.map((start) => ({ value: start - GAP_PX - size, guide: start - GAP_PX })),
  ];
}

function endPulls(starts: readonly number[], ends: readonly number[]): Pull[] {
  return [...ends.map((end) => ({ value: end, guide: end })), ...starts.map((start) => ({ value: start - GAP_PX, guide: start - GAP_PX }))];
}

export function snapMove(box: SnapBox, others: readonly SnapBox[], boardWidth: number, boardHeight = Infinity): Snapped {
  const x = closest(box.left, startPulls(others.map((other) => other.left), others.map((other) => other.left + other.width), box.width));
  const y = closest(box.top, startPulls(others.map((other) => other.top), others.map((other) => other.top + other.height), box.height));
  const left = within(x ? x.value : toDots(box.left), 0, boardWidth - box.width);
  const top = within(y ? y.value : toDots(box.top), 0, boardHeight - box.height);
  return { ...box, left, top, guideX: x && left === x.value ? x.guide : null, guideY: y && top === y.value ? y.guide : null };
}

export function snapStretch(box: SnapBox, others: readonly SnapBox[], boardWidth: number, least: { width: number; height: number }, boardHeight = Infinity): Snapped {
  const right = box.left + box.width;
  const bottom = box.top + box.height;
  const x = closest(right, endPulls(others.map((other) => other.left), others.map((other) => other.left + other.width)));
  const y = closest(bottom, endPulls(others.map((other) => other.top), others.map((other) => other.top + other.height)));
  const width = within((x ? x.value : toDots(right)) - box.left, least.width, boardWidth - box.left);
  const height = within((y ? y.value : toDots(bottom)) - box.top, least.height, boardHeight - box.top);
  return { ...box, width, height, guideX: x && box.left + width === x.value ? x.guide : null, guideY: y && box.top + height === y.value ? y.guide : null };
}
