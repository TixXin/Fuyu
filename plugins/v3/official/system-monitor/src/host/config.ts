import { DEFAULT_CONFIG, LAYOUT_OPTIONS, type Layout, type Locale, type MonitorConfig } from "../protocol.ts";

const BOOLEAN_KEYS = [
  "showOnBar",
  "barCpu",
  "barMemory",
  "barCpuTemperature",
  "barGpuTemperature",
  "backgroundHistory",
] as const;

export function normalizeLocale(value: unknown, fallback: Locale = DEFAULT_CONFIG.locale): Locale {
  if (value === "en" || value === "zh-CN") return value;
  return fallback;
}

export function normalizeInterval(value: unknown, fallback: number = DEFAULT_CONFIG.intervalMs): number {
  const n = typeof value === "number" ? Math.round(value) : Number(value);
  if (value === undefined || value === null || value === "" || !Number.isFinite(n)) return fallback;
  return Math.max(1000, Math.min(10000, n));
}

export function normalizeLayout(value: unknown, fallback: Layout = DEFAULT_CONFIG.layout): Layout {
  return (LAYOUT_OPTIONS as readonly unknown[]).includes(value) ? (value as Layout) : fallback;
}

export function mergeConfig(base: MonitorConfig, patch: unknown): MonitorConfig {
  const raw = patch && typeof patch === "object" ? (patch as Record<string, unknown>) : {};
  const next: MonitorConfig = {
    ...base,
    intervalMs: normalizeInterval(raw.intervalMs, base.intervalMs),
    layout: normalizeLayout(raw.layout, base.layout),
    locale: normalizeLocale(raw.locale, base.locale),
  };
  for (const key of BOOLEAN_KEYS) {
    const value = raw[key];
    if (typeof value === "boolean") next[key] = value;
  }
  return next;
}

export function parseConfigFile(text: string): MonitorConfig {
  try {
    return mergeConfig({ ...DEFAULT_CONFIG }, JSON.parse(text));
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}
