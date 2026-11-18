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

export type AlarmSnapshot = {
  alarms: AlarmItem[];
  ringing: RingingAlarm | null;
  defaultTone: AlarmTone;
  showInBar: boolean;
  at: number;
};

export const TOPICS = {
  snapshot: "alarm:snapshot",
  ring: "alarm:ring",
} as const;

export const METHODS = {
  snapshot: "alarm:get",
  add: "alarm:add",
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
