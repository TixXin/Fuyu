import type { WidgetEntrance } from "../settings/types";

export const WIDGET_ENTRANCES = [
  "shuffle",
  "fade",
  "spread",
  "curtain",
  "wave",
  "ripple",
  "skeleton",
  "trace",
  "glow",
  "drop",
  "bubble",
  "focus",
  "flip",
] as const satisfies readonly WidgetEntrance[];

export type WidgetEntranceEffect = Exclude<WidgetEntrance, "shuffle" | "fade">;

export const WIDGET_ENTRANCE_EFFECTS: readonly WidgetEntranceEffect[] = WIDGET_ENTRANCES.filter(
  (entrance): entrance is WidgetEntranceEffect => entrance !== "shuffle" && entrance !== "fade",
);

export type EntranceBag = { left: readonly WidgetEntranceEffect[]; last: WidgetEntranceEffect | null };

export const EMPTY_ENTRANCE_BAG: EntranceBag = { left: [], last: null };

function shuffled(random: () => number): WidgetEntranceEffect[] {
  const order = [...WIDGET_ENTRANCE_EFFECTS];
  for (let at = order.length - 1; at > 0; at--) {
    const pick = Math.min(at, Math.floor(random() * (at + 1)));
    [order[at], order[pick]] = [order[pick], order[at]];
  }
  return order;
}

export function drawEntrance(bag: EntranceBag, random: () => number): { effect: WidgetEntranceEffect; bag: EntranceBag } {
  let left = [...bag.left];
  if (left.length === 0) {
    left = shuffled(random);
    if (left[0] === bag.last && left.length > 1) [left[0], left[1]] = [left[1], left[0]];
  }
  const [effect, ...rest] = left;
  return { effect, bag: { left: rest, last: effect } };
}
