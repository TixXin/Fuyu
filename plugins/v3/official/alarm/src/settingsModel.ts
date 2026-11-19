import { normalizeTone, type AlarmTone } from "./model.ts";

export type TimeFormat = "system" | "24" | "12";
export type WeekStart = "system" | "mon" | "sun" | "sat";
export type OnceAfter = "keep" | "delete";
export type BarMode = "ringing" | "always";

export type AlarmSettings = {
  defaultTone: AlarmTone;
  snoozeMinutes: number;
  ringSeconds: number;
  volume: number;
  fadeIn: boolean;
  timeFormat: TimeFormat;
  weekStart: WeekStart;
  catchUp: boolean;
  onceAfter: OnceAfter;
  barMode: BarMode;
};

export const DEFAULT_SETTINGS: AlarmSettings = {
  defaultTone: "chime",
  snoozeMinutes: 5,
  ringSeconds: 30,
  volume: 70,
  fadeIn: false,
  timeFormat: "system",
  weekStart: "system",
  catchUp: true,
  onceAfter: "keep",
  barMode: "ringing",
};

export const SNOOZE_CHOICES = [1, 3, 5, 10, 15, 20, 30] as const;
export const RING_CHOICES = [15, 30, 60, 120, 300] as const;

const CHOICES = {
  timeFormat: ["system", "24", "12"],
  weekStart: ["system", "mon", "sun", "sat"],
  onceAfter: ["keep", "delete"],
  barMode: ["ringing", "always"],
} as const;

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function pickNumber(value: unknown, allowed: readonly number[], fallback: number): number {
  return typeof value === "number" && allowed.includes(value) ? value : fallback;
}

function clampVolume(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function normalizeSettings(raw: unknown, base: AlarmSettings = DEFAULT_SETTINGS): AlarmSettings {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    defaultTone: normalizeTone(src.defaultTone, base.defaultTone),
    snoozeMinutes: pickNumber(src.snoozeMinutes, SNOOZE_CHOICES, base.snoozeMinutes),
    ringSeconds: pickNumber(src.ringSeconds, RING_CHOICES, base.ringSeconds),
    volume: clampVolume(src.volume, base.volume),
    fadeIn: typeof src.fadeIn === "boolean" ? src.fadeIn : base.fadeIn,
    timeFormat: pick(src.timeFormat, CHOICES.timeFormat, base.timeFormat),
    weekStart: pick(src.weekStart, CHOICES.weekStart, base.weekStart),
    catchUp: typeof src.catchUp === "boolean" ? src.catchUp : base.catchUp,
    onceAfter: pick(src.onceAfter, CHOICES.onceAfter, base.onceAfter),
    barMode: pick(src.barMode, CHOICES.barMode, base.barMode),
  };
}

export function settingsFromStored(raw: Record<string, unknown> | null): AlarmSettings {
  if (!raw) return { ...DEFAULT_SETTINGS };
  const legacy: AlarmSettings = {
    ...DEFAULT_SETTINGS,
    defaultTone: normalizeTone(raw.defaultTone, DEFAULT_SETTINGS.defaultTone),
    barMode: raw.showInBar === false ? "ringing" : "always",
  };
  return normalizeSettings(raw.settings, legacy);
}
