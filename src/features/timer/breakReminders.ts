export const BREAK_ICONS = ["stand", "eye", "water", "stretch", "coffee", "bell"] as const;
export type BreakIcon = (typeof BREAK_ICONS)[number];

export type BreakReminder = { id: string; name: string; icon: BreakIcon; minutes: number; enabled: boolean };
export type BreakReminderSettings = { enabled: boolean; items: BreakReminder[] };
export type Presence = { idleSeconds: number | null; locked: boolean };
export type BreakProgress = Readonly<Record<string, number>>;

export const MIN_MINUTES = 1;
export const MAX_MINUTES = 480;
export const MAX_ITEMS = 8;
export const MAX_NAME_LENGTH = 40;
export const AWAY_AFTER_SECONDS = 300;
export const SNOOZE_MS = 5 * 60_000;
export const MAX_STEP_MS = 60_000;

export const DEFAULT_BREAK_REMINDERS: BreakReminderSettings = {
  enabled: false,
  items: [
    { id: "sit", name: "", icon: "stand", minutes: 60, enabled: true },
    { id: "eyes", name: "", icon: "eye", minutes: 20, enabled: true },
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function clampMinutes(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(value)));
}

function normalizeItem(value: unknown): BreakReminder | null {
  if (!isRecord(value) || typeof value.id !== "string" || value.id === "") return null;
  return {
    id: value.id,
    name: typeof value.name === "string" ? value.name.slice(0, MAX_NAME_LENGTH) : "",
    icon: BREAK_ICONS.find((icon) => icon === value.icon) ?? "bell",
    minutes: clampMinutes(value.minutes, 60),
    enabled: value.enabled !== false,
  };
}

export function normalizeBreakReminders(value: unknown): BreakReminderSettings {
  if (!isRecord(value)) return { ...DEFAULT_BREAK_REMINDERS, items: [...DEFAULT_BREAK_REMINDERS.items] };
  const seen = new Set<string>();
  const items = Array.isArray(value.items)
    ? value.items.flatMap((entry) => {
      const item = normalizeItem(entry);
      if (!item || seen.has(item.id)) return [];
      seen.add(item.id);
      return [item];
    }).slice(0, MAX_ITEMS)
    : [...DEFAULT_BREAK_REMINDERS.items];
  return { enabled: value.enabled === true, items };
}

export function isAway(presence: Presence): boolean {
  return presence.locked || (presence.idleSeconds ?? 0) >= AWAY_AFTER_SECONDS;
}

export const intervalMs = (item: BreakReminder) => item.minutes * 60_000;

export function advanceBreaks(
  settings: BreakReminderSettings,
  progress: BreakProgress,
  stepMs: number,
  presence: Presence,
): { progress: Record<string, number>; due: BreakReminder[] } {
  if (!settings.enabled) return { progress: {}, due: [] };
  const step = isAway(presence) ? 0 : Math.min(MAX_STEP_MS, Math.max(0, stepMs));
  const next: Record<string, number> = {};
  const due: BreakReminder[] = [];
  for (const item of settings.items) {
    if (!item.enabled) continue;
    const limit = intervalMs(item);
    const elapsed = Math.min(limit, (progress[item.id] ?? 0) + step);
    next[item.id] = elapsed;
    if (elapsed >= limit) due.push(item);
  }
  return { progress: next, due };
}

export function snoozedProgress(item: BreakReminder): number {
  return Math.max(0, intervalMs(item) - SNOOZE_MS);
}

export function newBreakReminder(id: string, icon: BreakIcon = "bell"): BreakReminder {
  return { id, name: "", icon, minutes: 30, enabled: true };
}

export function nextBreakIcon(icon: BreakIcon): BreakIcon {
  return BREAK_ICONS[(BREAK_ICONS.indexOf(icon) + 1) % BREAK_ICONS.length] ?? "bell";
}
