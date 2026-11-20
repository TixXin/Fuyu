import type { CollapsedPlacement } from "../../../lib/settings/collapsedItems.ts";

export type ItemPlace =
  | { kind: "left" | "right"; position: number }
  | { kind: "panel" | "hidden" | "absent" };

export function itemPlace(placements: readonly CollapsedPlacement[], listed: ReadonlySet<string>, id: string): ItemPlace {
  const placement = placements.find((candidate) => candidate.id === id);
  if (!placement || !listed.has(id)) return { kind: "absent" };
  if (placement.hidden) return { kind: "hidden" };
  if (placement.shelf) return { kind: "panel" };
  const zone = placements.filter((candidate) => candidate.zone === placement.zone && listed.has(candidate.id));
  return { kind: placement.zone, position: zone.findIndex((candidate) => candidate.id === id) + 1 };
}

export function firstListedMatch(listed: readonly string[], item: string): string | null {
  if (!item.endsWith(":")) return listed.includes(item) ? item : null;
  return listed.find((id) => id.startsWith(item)) ?? null;
}
