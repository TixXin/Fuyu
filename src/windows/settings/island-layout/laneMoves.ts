import type { CollapsedPlacement, CollapsedZone } from "../../../lib/settings/collapsedItems.ts";

export type LaneId = CollapsedZone | "shelf" | "off";
export type StepKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

const BAR_LANES: readonly LaneId[] = ["left", "right", "shelf"];

export function laneOf(placement: CollapsedPlacement): LaneId {
  if (placement.hidden) return "off";
  if (placement.shelf) return "shelf";
  return placement.zone;
}

export function laneIds(placements: readonly CollapsedPlacement[], lane: LaneId, listed: ReadonlySet<string>): string[] {
  return placements.filter((placement) => listed.has(placement.id) && laneOf(placement) === lane).map(({ id }) => id);
}

function inLane(placement: CollapsedPlacement, lane: Exclude<LaneId, "off">): CollapsedPlacement {
  if (lane === "shelf") return { id: placement.id, zone: placement.zone, shelf: true };
  return { id: placement.id, zone: lane };
}

export function placeItem(
  placements: readonly CollapsedPlacement[],
  id: string,
  lane: LaneId,
  before: string | null,
  listed: ReadonlySet<string>,
): CollapsedPlacement[] {
  const item = placements.find((placement) => placement.id === id);
  if (!item) return [...placements];
  if (lane === "off") return placements.map((placement) => (placement.id === id ? { ...placement, hidden: true } : placement));
  const rest = placements.filter((placement) => placement.id !== id);
  const anchor = before && before !== id ? rest.findIndex((placement) => placement.id === before) : -1;
  let at = anchor;
  if (at < 0) {
    const last = rest.reduce((found, placement, index) => (listed.has(placement.id) && laneOf(placement) === lane ? index : found), -1);
    at = last >= 0 ? last + 1 : lane === "left" ? 0 : rest.length;
  }
  rest.splice(at, 0, inLane(item, lane));
  return rest;
}

export function restoreItem(placements: readonly CollapsedPlacement[], id: string): CollapsedPlacement[] {
  return placements.map((placement) => {
    if (placement.id !== id) return placement;
    const { hidden: _hidden, ...rest } = placement;
    return rest;
  });
}

export function stepItem(
  placements: readonly CollapsedPlacement[],
  id: string,
  key: StepKey,
  listed: ReadonlySet<string>,
): CollapsedPlacement[] | null {
  const item = placements.find((placement) => placement.id === id);
  if (!item) return null;
  const lane = laneOf(item);
  if (key === "ArrowUp" || key === "ArrowDown") {
    const up = key === "ArrowUp";
    if (lane === "off") return up ? restoreItem(placements, id) : null;
    if (lane === "shelf") return up ? placeItem(placements, id, item.zone, null, listed) : placeItem(placements, id, "off", null, listed);
    return up ? null : placeItem(placements, id, "shelf", null, listed);
  }
  if (lane === "off") return null;
  const forward = key === "ArrowRight";
  const ids = laneIds(placements, lane, listed);
  const index = ids.indexOf(id);
  const neighbour = ids[index + (forward ? 1 : -1)];
  if (neighbour) {
    const next = [...placements];
    const from = next.findIndex((placement) => placement.id === id);
    const to = next.findIndex((placement) => placement.id === neighbour);
    [next[from], next[to]] = [next[to], next[from]];
    return next;
  }
  const target = BAR_LANES[BAR_LANES.indexOf(lane) + (forward ? 1 : -1)];
  if (!target) return null;
  return placeItem(placements, id, target, forward ? (laneIds(placements, target, listed)[0] ?? null) : null, listed);
}

export function sameLayout(a: readonly CollapsedPlacement[], b: readonly CollapsedPlacement[]): boolean {
  return a.length === b.length && a.every((placement, index) => {
    const other = b[index];
    return placement.id === other.id && placement.zone === other.zone && Boolean(placement.hidden) === Boolean(other.hidden) && Boolean(placement.shelf) === Boolean(other.shelf);
  });
}

export function firstSpilled(order: readonly string[], noRoom: ReadonlySet<string>): string | null {
  return order.find((id) => noRoom.has(id)) ?? null;
}
