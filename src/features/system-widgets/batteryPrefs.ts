import type { BatteryStats } from "./api";

export const BATTERY_PREFS_KEY = "fuyu-battery-prefs";
export const BATTERY_HISTORY_KEY = "fuyu-battery-history";
export const BATTERY_PREFS_EVENT = "fuyu-battery-prefs-changed";

export type BatteryCollapsedMode = "percent" | "time";

export type BatteryPrefs = {
  showCurve: boolean;
  collapsedMode: BatteryCollapsedMode;
};

export type BatteryPoint = {
  at: number;
  level: number;
  pluggedIn: boolean;
};

export const DEFAULT_BATTERY_PREFS: BatteryPrefs = {
  showCurve: true,
  collapsedMode: "percent",
};

const MAX_POINTS = 72;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MIN_GAP_MS = 2 * 60 * 1000;

export function normalizeBatteryPrefs(value: unknown): BatteryPrefs {
  const saved = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    showCurve: saved.showCurve !== false,
    collapsedMode: saved.collapsedMode === "time" ? "time" : "percent",
  };
}

export function normalizeBatteryHistory(value: unknown, now = Date.now()): BatteryPoint[] {
  if (!Array.isArray(value)) return [];
  const cutoff = now - MAX_AGE_MS;
  const points: BatteryPoint[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const at = typeof raw.at === "number" && Number.isFinite(raw.at) ? Math.round(raw.at) : 0;
    const level = typeof raw.level === "number" && Number.isFinite(raw.level) ? Math.round(raw.level) : -1;
    if (at < cutoff || at > now + 60_000 || level < 0 || level > 100) continue;
    points.push({ at, level, pluggedIn: raw.pluggedIn === true });
  }
  points.sort((a, b) => a.at - b.at);
  return points.slice(-MAX_POINTS);
}

export function appendBatterySample(
  history: readonly BatteryPoint[],
  sample: BatteryPoint,
): BatteryPoint[] {
  const cutoff = sample.at - MAX_AGE_MS;
  const fresh = history.filter((point) => point.at >= cutoff && point.at <= sample.at);
  const last = fresh[fresh.length - 1];
  if (last && last.level === sample.level && last.pluggedIn === sample.pluggedIn && sample.at - last.at < MIN_GAP_MS) {
    return fresh;
  }
  return [...fresh, sample].slice(-MAX_POINTS);
}

export function formatBatteryDuration(minutes: number, zh: boolean): string {
  const total = Math.max(1, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (zh) {
    if (hours === 0) return `${mins} 分钟`;
    return mins === 0 ? `${hours} 小时` : `${hours} 小时 ${mins} 分`;
  }
  if (hours === 0) return `${mins}m`;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

export function formatCompactDuration(minutes: number): string {
  const total = Math.max(1, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours === 0) return `${mins}m`;
  return mins === 0 ? `${hours}h` : `${hours}h${String(mins).padStart(2, "0")}`;
}

export function formatWattHours(mwh: number): string {
  return `${(mwh / 1000).toFixed(1)} Wh`;
}

export function formatWatts(rateMw: number): string {
  const watts = Math.abs(rateMw) / 1000;
  const sign = rateMw > 0 ? "+" : rateMw < 0 ? "−" : "";
  return `${sign}${watts.toFixed(1)} W`;
}

export function batteryChipText(battery: BatteryStats, mode: BatteryCollapsedMode): string | null {
  if (mode === "time") {
    const minutes = battery.pluggedIn ? battery.timeToFullMinutes : battery.remainingMinutes;
    if (typeof minutes === "number" && minutes > 0) return formatCompactDuration(minutes);
  }
  return typeof battery.level === "number" ? `${battery.level}%` : null;
}
