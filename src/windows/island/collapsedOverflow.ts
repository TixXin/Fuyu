export type OverflowSide = "left" | "right";
export type OverflowZone = { widths: readonly number[]; capacity: number };
export type OverflowFit = {
  left: boolean[];
  right: boolean[];
  chip: OverflowSide | null;
  used: Record<OverflowSide, number>;
};

type Prefix = { kept: number; used: number; shown: number };

function keepPrefix(widths: readonly number[], capacity: number, gap: number): Prefix {
  let used = 0;
  let kept = 0;
  let shown = 0;
  for (const width of widths) {
    if (!(width > 0)) {
      kept += 1;
      continue;
    }
    const next = used + width + (shown > 0 ? gap : 0);
    if (next > capacity) break;
    used = next;
    kept += 1;
    shown += 1;
  }
  return { kept, used, shown };
}

function keepAll(widths: readonly number[], gap: number): Prefix {
  const shown = widths.filter((width) => width > 0);
  return { kept: widths.length, used: shown.reduce((total, width) => total + width, 0) + gap * Math.max(0, shown.length - 1), shown: shown.length };
}

const shelvedFlags = (widths: readonly number[], kept: number) => widths.map((width, index) => index >= kept && width > 0);

export type OverflowOptions = { auto?: boolean; forceChip?: boolean };

export function fitCollapsedZones(left: OverflowZone, right: OverflowZone, gap: number, chipWidth: number, options: OverflowOptions = {}): OverflowFit {
  const auto = options.auto !== false;
  const zones: Record<OverflowSide, OverflowZone> = { left, right };
  const keep = (zone: OverflowZone, capacity = zone.capacity) => (auto ? keepPrefix(zone.widths, capacity, gap) : keepAll(zone.widths, gap));
  const kept: Record<OverflowSide, Prefix> = { left: keep(left), right: keep(right) };
  const flags = () => ({ left: shelvedFlags(left.widths, kept.left.kept), right: shelvedFlags(right.widths, kept.right.kept) });
  const first = flags();
  if (!first.left.includes(true) && !first.right.includes(true) && options.forceChip !== true) {
    return { ...first, chip: null, used: { left: kept.left.used, right: kept.right.used } };
  }
  const free = (side: OverflowSide) => zones[side].capacity - kept[side].used;
  const chip: OverflowSide = free("right") > free("left") ? "right" : "left";
  const need = chipWidth + (kept[chip].shown > 0 ? gap : 0);
  if (free(chip) < need) kept[chip] = keep(zones[chip], zones[chip].capacity - chipWidth - gap);
  const chipUsed = kept[chip].used + chipWidth + (kept[chip].shown > 0 ? gap : 0);
  return { ...flags(), chip, used: { left: kept.left.used, right: kept.right.used, [chip]: chipUsed } };
}

export function overflowCount(fit: Pick<OverflowFit, "left" | "right">, sizes: Record<OverflowSide, readonly number[]>) {
  const sum = (side: OverflowSide) => fit[side].reduce((total, shelved, index) => total + (shelved ? sizes[side][index] ?? 1 : 0), 0);
  return sum("left") + sum("right");
}
