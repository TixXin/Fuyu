import type { CollapsedPlacement, CollapsedZone } from "../../lib/settings/collapsedItems.ts";

export function emptierZone(placements: readonly CollapsedPlacement[], offered: readonly string[], fresh: readonly string[]): CollapsedZone {
  const present = new Set(offered);
  const count = (zone: CollapsedZone) => placements.filter((placement) => placement.zone === zone && !placement.hidden && !placement.shelf && present.has(placement.id) && !fresh.includes(placement.id)).length;
  return count("left") < count("right") ? "left" : "right";
}

export function placeFreshItems(saved: readonly CollapsedPlacement[], placements: readonly CollapsedPlacement[], offered: readonly string[], fresh: readonly string[]): CollapsedPlacement[] | null {
  const unsaved = fresh.filter((id) => offered.includes(id) && !saved.some((placement) => placement.id === id));
  if (unsaved.length === 0 || emptierZone(placements, offered, unsaved) === "right") return null;
  return [...saved, ...unsaved.map((id) => ({ id, zone: "left" as const }))];
}
