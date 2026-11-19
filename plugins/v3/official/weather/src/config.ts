export type TemperatureUnit = "celsius" | "fahrenheit";
export type WindUnit = "kmh" | "ms" | "mph" | "bft";
export type TimeFormat = "system" | "24" | "12";
export type BarStyle = "icon" | "text" | "temp";

export const HOUR_CHOICES = [6, 12, 24] as const;
export const REFRESH_CHOICES = [30, 60, 90, 120, 180] as const;
export const LEAD_CHOICES = [30, 60, 120] as const;
export const CONFIG_VERSION = 2;

export interface WeatherConfig {
  version: number;
  city: string;
  units: TemperatureUnit;
  windUnit: WindUnit;
  timeFormat: TimeFormat;
  showFeels: boolean;
  showHumidity: boolean;
  showWind: boolean;
  showPop: boolean;
  hours: number;
  showOnBar: boolean;
  barStyle: BarStyle;
  rainAlert: boolean;
  rainLeadMinutes: number;
  quietHours: boolean;
  quietStart: string;
  quietEnd: string;
  refreshMinutes: number;
}

export const DEFAULT_CONFIG: WeatherConfig = {
  version: CONFIG_VERSION,
  city: "",
  units: "celsius",
  windUnit: "kmh",
  timeFormat: "system",
  showFeels: true,
  showHumidity: false,
  showWind: false,
  showPop: true,
  hours: 6,
  showOnBar: false,
  barStyle: "icon",
  rainAlert: false,
  rainLeadMinutes: 60,
  quietHours: false,
  quietStart: "22:00",
  quietEnd: "07:00",
  refreshMinutes: 30,
};

type Raw = Record<string, unknown>;

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function choice(value: unknown, allowed: readonly number[], fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return allowed.includes(n) ? n : fallback;
}

function refreshMinutes(value: unknown): number {
  const n = typeof value === "number" ? Math.round(value) : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_CONFIG.refreshMinutes;
  return Math.max(30, Math.min(180, Math.round(n)));
}

function clock(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return fallback;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return fallback;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function normalizeConfig(raw: Raw, base: WeatherConfig = DEFAULT_CONFIG): WeatherConfig {
  return {
    version: CONFIG_VERSION,
    city: typeof raw.city === "string" ? raw.city.trim() : base.city,
    units: pick(raw.units, ["celsius", "fahrenheit"], base.units),
    windUnit: pick(raw.windUnit, ["kmh", "ms", "mph", "bft"], base.windUnit),
    timeFormat: pick(raw.timeFormat, ["system", "24", "12"], base.timeFormat),
    showFeels: flag(raw.showFeels, base.showFeels),
    showHumidity: flag(raw.showHumidity, base.showHumidity),
    showWind: flag(raw.showWind, base.showWind),
    showPop: flag(raw.showPop, base.showPop),
    hours: choice(raw.hours, HOUR_CHOICES, base.hours),
    showOnBar: flag(raw.showOnBar, base.showOnBar),
    barStyle: pick(raw.barStyle, ["icon", "text", "temp"], base.barStyle),
    rainAlert: flag(raw.rainAlert, base.rainAlert),
    rainLeadMinutes: choice(raw.rainLeadMinutes, LEAD_CHOICES, base.rainLeadMinutes),
    quietHours: flag(raw.quietHours, base.quietHours),
    quietStart: clock(raw.quietStart, base.quietStart),
    quietEnd: clock(raw.quietEnd, base.quietEnd),
    refreshMinutes: raw.refreshMinutes === undefined ? base.refreshMinutes : refreshMinutes(raw.refreshMinutes),
  };
}

export function configFromStored(raw: unknown): WeatherConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...DEFAULT_CONFIG };
  const stored = raw as Raw;
  const config = normalizeConfig(stored);
  if (stored.version === CONFIG_VERSION) return config;
  const savedByUser = config.city !== "";
  return {
    ...config,
    showOnBar: savedByUser ? flag(stored.showOnBar, true) : false,
    rainAlert: savedByUser ? flag(stored.rainAlert, true) : false,
  };
}
