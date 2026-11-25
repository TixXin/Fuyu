export type OverflowSide = "left" | "right";
export type OverflowZone = { widths: readonly number[]; capacity: number; movable?: readonly boolean[]; keep?: readonly boolean[] };
export type OverflowFit = {
  left: boolean[];
  right: boolean[];
  moved: Record<OverflowSide, boolean[]>;
  chip: OverflowSide | null;
  used: Record<OverflowSide, number>;
};

type Room = { used: number; count: number };
type Entry = { from: OverflowSide; index: number; width: number };
type Lanes = Record<OverflowSide, Entry[]>;
type Packed = { shown: Record<OverflowSide, boolean[]>; moved: Record<OverflowSide, boolean[]>; room: Record<OverflowSide, Room> };

const SIDES: readonly OverflowSide[] = ["left", "right"];
const OTHER: Record<OverflowSide, OverflowSide> = { left: "right", right: "left" };
export const NOTCH_SIDE_LEAST = 2;

const visibleCount = (lane: readonly Entry[]) => lane.filter((entry) => entry.width > 0).length;

export function balancedLanes(left: readonly number[], right: readonly number[], least = 0): Lanes {
  const own = (from: OverflowSide, widths: readonly number[]) => widths.map((width, index) => ({ from, index, width }));
  const lanes: Lanes = { left: own("left", left), right: own("right", right) };
  if (least <= 0) return lanes;
  const counts = { left: visibleCount(lanes.left), right: visibleCount(lanes.right) };
  if (counts.left < least && counts.right > least) {
    for (let step = Math.min(least - counts.left, counts.right - least); step > 0; step -= 1) {
      lanes.left.push(...lanes.right.splice(lanes.right.findIndex((entry) => entry.width > 0), 1));
    }
  } else if (counts.right < least && counts.left > least) {
    for (let step = Math.min(least - counts.right, counts.left - least); step > 0; step -= 1) {
      const at = lanes.left.map((entry) => entry.width > 0).lastIndexOf(true);
      lanes.right.unshift(...lanes.left.splice(at, 1));
    }
  }
  return lanes;
}

export function isUnbalanced(left: number, right: number, least = NOTCH_SIDE_LEAST) {
  return (left < least && right > least) || (right < least && left > least);
}

const span = (entries: readonly Entry[], gap: number) =>
  entries.reduce((total, entry) => total + entry.width, 0) + gap * Math.max(0, entries.length - 1);

export function leastWing(lanes: Lanes, reserved: Record<OverflowSide, number>, gap: number, chipWidth: number, least = NOTCH_SIDE_LEAST, chip = false) {
  const need = (side: OverflowSide) => reserved[side] + span(lanes[side].filter((entry) => entry.width > 0).slice(0, least), gap);
  const sides = SIDES.map(need);
  const more = chip || SIDES.some((side) => visibleCount(lanes[side]) > least);
  return Math.max(...sides, more ? Math.min(...sides) + chipWidth + gap : 0);
}

function pack(zones: Record<OverflowSide, OverflowZone>, lanes: Lanes, capacity: Record<OverflowSide, number>, gap: number, everything: boolean): Packed {
  const room: Record<OverflowSide, Room> = { left: { used: 0, count: 0 }, right: { used: 0, count: 0 } };
  const shown = { left: zones.left.widths.map((width) => !(width > 0)), right: zones.right.widths.map((width) => !(width > 0)) };
  const moved = { left: zones.left.widths.map(() => false), right: zones.right.widths.map(() => false) };
  const put = (side: OverflowSide, width: number) => {
    const next = room[side].used + width + (room[side].count > 0 ? gap : 0);
    if (!everything && next > capacity[side]) return false;
    room[side] = { used: next, count: room[side].count + 1 };
    return true;
  };
  const place = (entry: Entry, side: OverflowSide) => {
    shown[entry.from][entry.index] = true;
    moved[entry.from][entry.index] = entry.from !== side;
  };
  const isKept = (entry: Entry) => zones[entry.from].keep?.[entry.index] === true;
  for (const side of SIDES) for (const entry of lanes[side]) {
    if (entry.width > 0 && isKept(entry) && put(side, entry.width)) place(entry, side);
  }
  for (const side of SIDES) for (const entry of lanes[side]) {
    if (entry.width > 0 && !shown[entry.from][entry.index] && put(side, entry.width)) place(entry, side);
  }
  if (!everything) for (const side of SIDES) for (const entry of lanes[side]) {
    if (shown[entry.from][entry.index]) continue;
    const returning = entry.from !== side;
    if (!returning && zones[entry.from].movable?.[entry.index] !== true) continue;
    if (put(OTHER[side], entry.width)) place(entry, OTHER[side]);
  }
  return { shown, moved, room };
}

export type OverflowOptions = { auto?: boolean; forceChip?: boolean; least?: number };

export function fitCollapsedZones(left: OverflowZone, right: OverflowZone, gap: number, chipWidth: number, options: OverflowOptions = {}): OverflowFit {
  const everything = options.auto === false;
  const zones: Record<OverflowSide, OverflowZone> = { left, right };
  const lanes = balancedLanes(left.widths, right.widths, options.least ?? 0);
  const result = (packed: Packed, chip: OverflowSide | null): OverflowFit => {
    const used = { left: packed.room.left.used, right: packed.room.right.used };
    if (chip) used[chip] += chipWidth + (packed.room[chip].count > 0 ? gap : 0);
    return {
      left: packed.shown.left.map((shown) => !shown),
      right: packed.shown.right.map((shown) => !shown),
      moved: packed.moved,
      chip,
      used,
    };
  };
  const first = pack(zones, lanes, { left: left.capacity, right: right.capacity }, gap, everything);
  const hidden = SIDES.some((side) => first.shown[side].includes(false));
  if (!hidden && options.forceChip !== true) return result(first, null);
  const free = (side: OverflowSide) => zones[side].capacity - first.room[side].used;
  const preferred: OverflowSide = free("right") > free("left") ? "right" : "left";
  const withChip = (chip: OverflowSide) => {
    if (everything || free(chip) >= chipWidth + (first.room[chip].count > 0 ? gap : 0)) return first;
    return pack(zones, lanes, { left: left.capacity, right: right.capacity, [chip]: zones[chip].capacity - chipWidth - gap }, gap, false);
  };
  const best = withChip(preferred);
  const other = withChip(OTHER[preferred]);
  return shownCount(other) > shownCount(best) ? result(other, OTHER[preferred]) : result(best, preferred);
}

const shownCount = (packed: Packed) => SIDES.reduce((total, side) => total + packed.room[side].count, 0);

export function overflowCount(fit: Pick<OverflowFit, "left" | "right">, sizes: Record<OverflowSide, readonly number[]>) {
  const sum = (side: OverflowSide) => fit[side].reduce((total, shelved, index) => total + (shelved ? sizes[side][index] ?? 1 : 0), 0);
  return sum("left") + sum("right");
}

export type PillFit = { away: boolean[]; chip: boolean; used: number };

export function fitPill(widths: readonly number[], capacity: number, gap: number, chipWidth: number, options: Omit<OverflowOptions, "least"> = {}): PillFit {
  const pack = (room: number) => {
    let used = 0;
    const away = widths.map((width) => {
      if (!(width > 0)) return false;
      if (options.auto !== false && used + width + gap > room) return true;
      used += width + gap;
      return false;
    });
    return { away, used };
  };
  const first = pack(capacity);
  if (!first.away.includes(true) && options.forceChip !== true) return { ...first, chip: false };
  const chipCost = chipWidth + gap;
  const second = options.auto === false || first.used + chipCost <= capacity ? first : pack(capacity - chipCost);
  return { away: second.away, chip: true, used: second.used + chipCost };
}

export const HYDRATE_GRACE_MS = 350;

export type HydrateCheck = {
  width: number;
  hydrating: boolean;
  retryIn: number | null;
};

export function resolveUnitWidth(
  measured: number,
  previous: number,
  hydrated: boolean,
  mountedAt: number,
  now: number,
  graceMs = HYDRATE_GRACE_MS,
): HydrateCheck {
  if (measured > 0) return { width: measured, hydrating: false, retryIn: null };
  if (hydrated || !(previous > 0)) return { width: 0, hydrating: false, retryIn: null };
  const remaining = mountedAt + graceMs - now;
  if (remaining > 0) return { width: previous, hydrating: true, retryIn: remaining };
  return { width: 0, hydrating: false, retryIn: null };
}
