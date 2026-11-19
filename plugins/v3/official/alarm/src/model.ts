import type { AlarmSettings } from "./settingsModel.ts";

export type AlarmTone = "chime" | "bell" | "digital" | "mute";

export const ALARM_TONES: readonly AlarmTone[] = ["chime", "bell", "digital", "mute"];

export type AlarmItem = {
  id: string;
  time: string;
  label: string;
  days: number[];
  tone: AlarmTone;
  enabled: boolean;
  lastFiredMinute: string | null;
};

export type RingingAlarm = {
  id: string;
  label: string;
  time: string;
  tone: AlarmTone;
  firedAt: number;
};

export type RingPayload = RingingAlarm & {
  volume: number;
  fadeIn: boolean;
  ringMs: number;
};

export type SnoozedAlarm = {
  dueAt: number;
  alarm: RingingAlarm;
};

export type AlarmSnapshot = {
  alarms: AlarmItem[];
  ringing: RingingAlarm | null;
  snoozed: SnoozedAlarm | null;
  settings: AlarmSettings;
  at: number;
};

export type AlarmDraft = {
  time: string;
  label: string;
  days: number[];
  tone: AlarmTone;
};

export const MAX_ALARMS = 40;
export const MAX_LABEL = 60;

export const TOPICS = {
  snapshot: "alarm:snapshot",
  ring: "alarm:ring",
} as const;

export const METHODS = {
  snapshot: "alarm:get",
  add: "alarm:add",
  update: "alarm:update",
  toggle: "alarm:toggle",
  remove: "alarm:remove",
  dismiss: "alarm:dismiss",
  snooze: "alarm:snooze",
  setSettings: "alarm:set-settings",
} as const;

export function isValidTime(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [h, m] = value.split(":").map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

export function normalizeDays(days: unknown): number[] {
  if (!Array.isArray(days)) return [];
  const valid = days.filter((d): d is number => typeof d === "number" && Number.isInteger(d) && d >= 0 && d <= 6);
  return [...new Set(valid)].sort((a, b) => a - b);
}

export function normalizeTone(value: unknown, fallback: AlarmTone = "chime"): AlarmTone {
  return typeof value === "string" && (ALARM_TONES as readonly string[]).includes(value) ? (value as AlarmTone) : fallback;
}

export function minuteKey(at: number): { key: string; hhmm: string; day: number } {
  const dt = new Date(at);
  const y = dt.getFullYear();
  const mo = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  const hhmm = `${hh}:${mm}`;
  return { key: `${y}-${mo}-${d} ${hhmm}`, hhmm, day: dt.getDay() };
}

export function shouldFireAlarm(alarm: AlarmItem, at: number): boolean {
  if (!alarm.enabled) return false;
  const current = minuteKey(at);
  if (alarm.time !== current.hhmm) return false;
  if (alarm.lastFiredMinute === current.key) return false;
  if (alarm.days.length > 0 && !alarm.days.includes(current.day)) return false;
  return true;
}

export function nextScheduledAlarm(alarms: readonly AlarmItem[], at: number): { alarm: AlarmItem; minutesAway: number } | null {
  const dt = new Date(at);
  const nowMinutes = dt.getHours() * 60 + dt.getMinutes();
  const today = dt.getDay();
  let best: { alarm: AlarmItem; minutesAway: number } | null = null;

  for (const alarm of alarms) {
    if (!alarm.enabled || !isValidTime(alarm.time)) continue;
    const [h, m] = alarm.time.split(":").map(Number);
    const targetMinutes = h * 60 + m;
    for (let offsetDay = 0; offsetDay <= 7; offsetDay += 1) {
      const candidateDay = (today + offsetDay) % 7;
      if (alarm.days.length > 0 && !alarm.days.includes(candidateDay)) continue;
      const diff = offsetDay * 1440 + (targetMinutes - nowMinutes);
      if (diff <= 0) continue;
      if (!best || diff < best.minutesAway) {
        best = { alarm, minutesAway: diff };
      }
      break;
    }
  }
  return best;
}

function occurrenceAt(at: number, hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  const dt = new Date(at);
  dt.setHours(h, m, 0, 0);
  return dt.getTime();
}

export type MissedAlarm = { alarm: AlarmItem; at: number; key: string };

export function missedAlarms(alarms: readonly AlarmItem[], from: number, to: number): MissedAlarm[] {
  if (!(to > from)) return [];
  const missed: MissedAlarm[] = [];
  for (const alarm of alarms) {
    if (!alarm.enabled || !isValidTime(alarm.time)) continue;
    for (let back = 0; back <= 7; back += 1) {
      const day = new Date(to);
      day.setDate(day.getDate() - back);
      const at = occurrenceAt(day.getTime(), alarm.time);
      if (at > to) continue;
      if (at <= from) break;
      if (alarm.days.length > 0 && !alarm.days.includes(new Date(at).getDay())) continue;
      const key = minuteKey(at).key;
      if (alarm.lastFiredMinute !== key) missed.push({ alarm, at, key });
      break;
    }
  }
  return missed.sort((a, b) => a.at - b.at);
}

export function normalizeDraft(raw: unknown, fallbackTone: AlarmTone): AlarmDraft | null {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const time = typeof src.time === "string" ? src.time.trim() : "";
  if (!isValidTime(time)) return null;
  return {
    time,
    label: typeof src.label === "string" ? src.label.trim().slice(0, MAX_LABEL) : "",
    days: normalizeDays(src.days),
    tone: normalizeTone(src.tone, fallbackTone),
  };
}

export function normalizeAlarms(raw: unknown, fallbackTone: AlarmTone): AlarmItem[] {
  if (!Array.isArray(raw)) return [];
  const out: AlarmItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const src = item as Record<string, unknown>;
    if (typeof src.id !== "string") continue;
    const draft = normalizeDraft(src, fallbackTone);
    if (!draft) continue;
    out.push({
      id: src.id,
      ...draft,
      enabled: src.enabled !== false,
      lastFiredMinute: typeof src.lastFiredMinute === "string" ? src.lastFiredMinute : null,
    });
    if (out.length >= MAX_ALARMS) break;
  }
  return out;
}

export function normalizeSnoozed(raw: unknown): SnoozedAlarm | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  const alarm = src.alarm as Record<string, unknown> | undefined;
  if (typeof src.dueAt !== "number" || !Number.isFinite(src.dueAt) || !alarm || typeof alarm.id !== "string") return null;
  const time = typeof alarm.time === "string" && isValidTime(alarm.time) ? alarm.time : null;
  if (!time) return null;
  return {
    dueAt: src.dueAt,
    alarm: {
      id: alarm.id,
      time,
      label: typeof alarm.label === "string" ? alarm.label.slice(0, MAX_LABEL) : "",
      tone: normalizeTone(alarm.tone),
      firedAt: typeof alarm.firedAt === "number" ? alarm.firedAt : src.dueAt,
    },
  };
}
