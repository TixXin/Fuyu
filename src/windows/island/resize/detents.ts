export type DetentId = "min" | "compact" | "default" | "wide" | "tall" | "max" | "plus60" | "plus120";
export type Detent = { value: number; id: DetentId };
export type PresetId = "compact" | "default" | "large";
export type Preset = { id: PresetId; width: number; height: number };
export type Limits = { min: number; max: number };
export type Snapped = { value: number; detent: DetentId | null };

export const FREE_SNAP = 10;
export const PRESET_SNAP = 28;
const MIN_GAP = 40;

function pick(candidates: Detent[], limits: Limits): Detent[] {
  const kept: Detent[] = [];
  for (const candidate of candidates) {
    if (candidate.value < limits.min || candidate.value > limits.max) continue;
    if (kept.some((detent) => Math.abs(detent.value - candidate.value) < MIN_GAP)) continue;
    kept.push(candidate);
  }
  return kept.sort((a, b) => a.value - b.value);
}

export function widthDetents(defaultWidth: number, limits: Limits): Detent[] {
  return pick([
    { value: defaultWidth, id: "default" },
    { value: limits.min, id: "min" },
    { value: limits.max, id: "max" },
    { value: 640, id: "compact" },
    { value: 1040, id: "wide" },
  ], limits);
}

export function heightDetents(defaultHeight: number, limits: Limits): Detent[] {
  return pick([
    { value: defaultHeight, id: "default" },
    { value: limits.min, id: "min" },
    { value: limits.max, id: "max" },
    { value: 560, id: "tall" },
  ], limits);
}

export function collapsedDetents(limits: Limits): Detent[] {
  return pick([
    { value: 0, id: "default" },
    { value: limits.min, id: "min" },
    { value: limits.max, id: "max" },
    { value: 60, id: "plus60" },
    { value: 120, id: "plus120" },
  ], limits);
}

export function snap(value: number, detents: Detent[], radius = FREE_SNAP): Snapped {
  let best: Detent | null = null;
  for (const detent of detents) {
    if (Math.abs(detent.value - value) <= radius && (!best || Math.abs(detent.value - value) < Math.abs(best.value - value))) best = detent;
  }
  return best ? { value: best.value, detent: best.id } : { value, detent: null };
}

export function panelPresets(defaults: { width: number; height: number }, width: Limits, height: Limits): Preset[] {
  const clampTo = (value: number, limits: Limits) => Math.min(limits.max, Math.max(limits.min, value));
  return [
    { id: "compact", width: width.min, height: height.min },
    { id: "default", width: clampTo(defaults.width, width), height: clampTo(defaults.height, height) },
    { id: "large", width: clampTo(1040, width), height: clampTo(560, height) },
  ];
}

export function snapPreset(width: number, height: number, presets: Preset[], radius = PRESET_SNAP): Preset | null {
  let best: { preset: Preset; distance: number } | null = null;
  for (const preset of presets) {
    const distance = Math.hypot(width - preset.width, height - preset.height);
    if (distance <= radius && (!best || distance < best.distance)) best = { preset, distance };
  }
  return best?.preset ?? null;
}
