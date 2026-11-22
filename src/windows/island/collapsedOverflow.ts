export type OverflowSide = "left" | "right";
export type OverflowZone = { widths: readonly number[]; capacity: number; movable?: readonly boolean[] };
export type OverflowFit = {
  left: boolean[];
  right: boolean[];
  moved: Record<OverflowSide, boolean[]>;
  chip: OverflowSide | null;
  used: Record<OverflowSide, number>;
};

type Room = { used: number; count: number };
type Packed = { shown: Record<OverflowSide, boolean[]>; moved: Record<OverflowSide, boolean[]>; room: Record<OverflowSide, Room> };

const SIDES: readonly OverflowSide[] = ["left", "right"];
const OTHER: Record<OverflowSide, OverflowSide> = { left: "right", right: "left" };

function pack(zones: Record<OverflowSide, OverflowZone>, capacity: Record<OverflowSide, number>, gap: number, everything: boolean): Packed {
  const room: Record<OverflowSide, Room> = { left: { used: 0, count: 0 }, right: { used: 0, count: 0 } };
  const shown = { left: zones.left.widths.map((width) => !(width > 0)), right: zones.right.widths.map((width) => !(width > 0)) };
  const moved = { left: zones.left.widths.map(() => false), right: zones.right.widths.map(() => false) };
  const put = (side: OverflowSide, width: number) => {
    const next = room[side].used + width + (room[side].count > 0 ? gap : 0);
    if (!everything && next > capacity[side]) return false;
    room[side] = { used: next, count: room[side].count + 1 };
    return true;
  };
  for (const side of SIDES) zones[side].widths.forEach((width, index) => {
    if (width > 0 && put(side, width)) shown[side][index] = true;
  });
  if (!everything) for (const side of SIDES) zones[side].widths.forEach((width, index) => {
    if (shown[side][index] || zones[side].movable?.[index] !== true || !put(OTHER[side], width)) return;
    shown[side][index] = true;
    moved[side][index] = true;
  });
  return { shown, moved, room };
}

export type OverflowOptions = { auto?: boolean; forceChip?: boolean };

export function fitCollapsedZones(left: OverflowZone, right: OverflowZone, gap: number, chipWidth: number, options: OverflowOptions = {}): OverflowFit {
  const everything = options.auto === false;
  const zones: Record<OverflowSide, OverflowZone> = { left, right };
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
  const first = pack(zones, { left: left.capacity, right: right.capacity }, gap, everything);
  const hidden = SIDES.some((side) => first.shown[side].includes(false));
  if (!hidden && options.forceChip !== true) return result(first, null);
  const free = (side: OverflowSide) => zones[side].capacity - first.room[side].used;
  const preferred: OverflowSide = free("right") > free("left") ? "right" : "left";
  const withChip = (chip: OverflowSide) => {
    if (everything || free(chip) >= chipWidth + (first.room[chip].count > 0 ? gap : 0)) return first;
    return pack(zones, { left: left.capacity, right: right.capacity, [chip]: zones[chip].capacity - chipWidth - gap }, gap, false);
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
