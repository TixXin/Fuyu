import type { MirrorFrame } from "../../../features/plugin-kernel/barMirror.ts";
import type { CollapsedZone } from "../../../lib/settings/collapsedItems.ts";

export type SeenState = "empty" | "left" | "right";

export function seenOnBar(
  frame: MirrorFrame | null,
  placed: readonly { id: string; zone: CollapsedZone }[],
  overflow: ReadonlySet<string>,
): ReadonlyMap<string, SeenState> {
  const seen = new Map<string, SeenState>();
  if (!frame || !frame.shown || frame.form === "side" || frame.items.length === 0) return seen;
  const boxes = new Map(frame.items.map((item) => [item.id, item.box]));
  const middle = frame.middle;
  for (const { id, zone } of placed) {
    if (overflow.has(id)) continue;
    const box = boxes.get(id);
    if (!box) {
      seen.set(id, "empty");
      continue;
    }
    if (!middle) continue;
    const center = box.left + box.width / 2;
    const side: CollapsedZone | null = center < middle.left ? "left" : center > middle.left + middle.width ? "right" : null;
    if (side && side !== zone) seen.set(id, side);
  }
  return seen;
}
