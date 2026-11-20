import type { CalendarEvent } from "./api";

export const COUNTDOWN_SCOPES = ["all", "meetingsOnly"] as const;
export type CountdownScope = (typeof COUNTDOWN_SCOPES)[number];

export const COUNTDOWN_FORMATS = ["titleMinutes", "timeTitle", "compact"] as const;
export type CountdownFormat = (typeof COUNTDOWN_FORMATS)[number];

export const CALENDAR_HOLD_MINUTES = [0, 5, 15, -1] as const;
export type CalendarHoldMinutes = (typeof CALENDAR_HOLD_MINUTES)[number];

export const CALENDAR_BANNER_MINUTES = [0, 1, 3, 5] as const;
export type CalendarBannerMinutes = (typeof CALENDAR_BANNER_MINUTES)[number];

export const AGENDA_RANGES = ["twoDays", "sevenDays"] as const;
export type AgendaRange = (typeof AGENDA_RANGES)[number];

export const WEEK_STARTS_ON = ["auto", "monday", "sunday"] as const;
export type WeekStartsOn = (typeof WEEK_STARTS_ON)[number];

export const CALENDAR_COLOR_PALETTE = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
] as const;

export type CalendarPrefs = {
  countdownScope: CountdownScope;
  countdownFormat: CountdownFormat;
  holdMinutes: CalendarHoldMinutes;
  bannerEnabled: boolean;
  bannerMinutes: CalendarBannerMinutes;
  holidayEveReminder: boolean;
  pauseMediaOnJoin: boolean;
  agendaRange: AgendaRange;
  hideDeclined: boolean;
  ignoreFreeInCountdown: boolean;
  foldAllDay: boolean;
  showWeekNumbers: boolean;
  weekStartsOn: WeekStartsOn;
  includeTimedTodos: boolean;
  customMeetingDomain: string;
  hiddenCalendars: string[];
  noCountdownCalendars: string[];
  calendarColors: Record<string, string>;
};

export const DEFAULT_CALENDAR_PREFS: CalendarPrefs = {
  countdownScope: "all",
  countdownFormat: "titleMinutes",
  holdMinutes: 5,
  bannerEnabled: true,
  bannerMinutes: 1,
  holidayEveReminder: true,
  pauseMediaOnJoin: true,
  agendaRange: "twoDays",
  hideDeclined: true,
  ignoreFreeInCountdown: true,
  foldAllDay: false,
  showWeekNumbers: false,
  weekStartsOn: "auto",
  includeTimedTodos: true,
  customMeetingDomain: "",
  hiddenCalendars: [],
  noCountdownCalendars: [],
  calendarColors: {},
};

const DOMAIN_HOST = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(?::(\d{1,5}))?$/;
const HTTPS_URLS = /https:\/\/[^\s<>"')\]}，。；！）】]+/giu;
const TRAILING_PUNCT = /[.,;:!?)'"\]}]+$/;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const MAX_LIST_ENTRIES = 100;

function pick<T>(allowed: readonly T[], value: unknown, fallback: T): T {
  return (allowed as readonly unknown[]).includes(value) ? (value as T) : fallback;
}

export function normalizeCalendarColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (HEX_COLOR.test(trimmed)) return trimmed;
  if (/^#[0-9a-f]{8}$/i.test(trimmed)) return trimmed.slice(0, 7);
  return null;
}

export function resolveCalendarColor(
  calendarName: string,
  overrides: Readonly<Record<string, string>> | undefined,
  nativeColors?: Readonly<Record<string, string | null | undefined>>,
): string | null {
  const key = calendarName.trim();
  if (!key) return null;
  const override = overrides ? normalizeCalendarColor(overrides[key]) : null;
  if (override) return override;
  const native = nativeColors ? normalizeCalendarColor(nativeColors[key]) : null;
  return native;
}

export function cycleCalendarColor(current: string | null): string | null {
  if (!current) return CALENDAR_COLOR_PALETTE[0];
  const normalized = current.toLowerCase();
  const idx = CALENDAR_COLOR_PALETTE.findIndex((item) => item === normalized);
  if (idx < 0) return CALENDAR_COLOR_PALETTE[0];
  if (idx + 1 >= CALENDAR_COLOR_PALETTE.length) return null;
  return CALENDAR_COLOR_PALETTE[idx + 1];
}

function normalizeNameList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim().slice(0, 120);
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= MAX_LIST_ENTRIES) break;
  }
  return out;
}

function normalizeColorMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  let count = 0;
  for (const [rawKey, rawVal] of Object.entries(value as Record<string, unknown>)) {
    const key = rawKey.trim().slice(0, 120);
    const color = normalizeCalendarColor(rawVal);
    if (!key || !color) continue;
    out[key] = color;
    count += 1;
    if (count >= MAX_LIST_ENTRIES) break;
  }
  return out;
}

export function parseMeetingDomain(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let candidate = value.trim().toLowerCase();
  if (!candidate || /\s/.test(candidate)) return null;
  if (candidate.startsWith("https://")) candidate = candidate.slice("https://".length);
  else if (candidate.startsWith("http://")) candidate = candidate.slice("http://".length);
  else if (candidate.includes("://")) return null;
  const slash = candidate.search(/[/?#]/);
  if (slash >= 0) candidate = candidate.slice(0, slash);
  const match = DOMAIN_HOST.exec(candidate);
  if (!match) return null;
  if (match[1] !== undefined) {
    const port = Number(match[1]);
    if (port < 1 || port > 65535) return null;
  }
  return candidate;
}

export function extractCustomMeetingLink(text: string | null | undefined, customDomain: string): string | null {
  const domain = parseMeetingDomain(customDomain);
  if (!domain || !text) return null;
  const matches = text.match(HTTPS_URLS);
  if (!matches) return null;
  const domainHasPort = domain.includes(":");
  for (const raw of matches) {
    const cleaned = raw.replace(TRAILING_PUNCT, "");
    try {
      const parsed = new URL(cleaned);
      if (parsed.protocol !== "https:") continue;
      const host = parsed.host.toLowerCase();
      const hostname = parsed.hostname.toLowerCase();
      const matched = domainHasPort
        ? host === domain
        : hostname === domain || hostname.endsWith(`.${domain}`);
      if (matched) return parsed.toString();
    } catch {
      continue;
    }
  }
  return null;
}

export function withCalendarEventPrefs(event: CalendarEvent, customDomain: string): CalendarEvent {
  if (event.meetingLink || !event.location || !customDomain) return event;
  const link = extractCustomMeetingLink(event.location, customDomain);
  return link ? { ...event, meetingLink: link } : event;
}

export function prepareCalendarEvents(
  events: readonly CalendarEvent[],
  prefs: Pick<CalendarPrefs, "hideDeclined" | "customMeetingDomain"> & { hiddenCalendars?: readonly string[] },
): CalendarEvent[] {
  const hidden = prefs.hiddenCalendars && prefs.hiddenCalendars.length > 0 ? new Set(prefs.hiddenCalendars) : null;
  const out: CalendarEvent[] = [];
  for (const event of events) {
    if (prefs.hideDeclined && event.declined === true) continue;
    if (hidden && event.calendar && hidden.has(event.calendar.trim())) continue;
    out.push(withCalendarEventPrefs(event, prefs.customMeetingDomain));
  }
  return out;
}

export function normalizeCalendarPrefs(value: unknown): CalendarPrefs {
  const saved = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const rawDomain = typeof saved.customMeetingDomain === "string"
    ? saved.customMeetingDomain.replace(/[\r\n\t]/g, "").trim().slice(0, 200)
    : DEFAULT_CALENDAR_PREFS.customMeetingDomain;
  return {
    countdownScope: pick(COUNTDOWN_SCOPES, saved.countdownScope, DEFAULT_CALENDAR_PREFS.countdownScope),
    countdownFormat: pick(COUNTDOWN_FORMATS, saved.countdownFormat, DEFAULT_CALENDAR_PREFS.countdownFormat),
    holdMinutes: pick(CALENDAR_HOLD_MINUTES, saved.holdMinutes, DEFAULT_CALENDAR_PREFS.holdMinutes),
    bannerEnabled: saved.bannerEnabled !== undefined ? Boolean(saved.bannerEnabled) : DEFAULT_CALENDAR_PREFS.bannerEnabled,
    bannerMinutes: pick(CALENDAR_BANNER_MINUTES, saved.bannerMinutes, DEFAULT_CALENDAR_PREFS.bannerMinutes),
    holidayEveReminder: saved.holidayEveReminder !== undefined ? Boolean(saved.holidayEveReminder) : DEFAULT_CALENDAR_PREFS.holidayEveReminder,
    pauseMediaOnJoin: saved.pauseMediaOnJoin !== undefined ? Boolean(saved.pauseMediaOnJoin) : DEFAULT_CALENDAR_PREFS.pauseMediaOnJoin,
    agendaRange: pick(AGENDA_RANGES, saved.agendaRange, DEFAULT_CALENDAR_PREFS.agendaRange),
    hideDeclined: saved.hideDeclined !== undefined ? Boolean(saved.hideDeclined) : DEFAULT_CALENDAR_PREFS.hideDeclined,
    ignoreFreeInCountdown: saved.ignoreFreeInCountdown !== undefined ? Boolean(saved.ignoreFreeInCountdown) : DEFAULT_CALENDAR_PREFS.ignoreFreeInCountdown,
    foldAllDay: saved.foldAllDay !== undefined ? Boolean(saved.foldAllDay) : DEFAULT_CALENDAR_PREFS.foldAllDay,
    showWeekNumbers: saved.showWeekNumbers !== undefined ? Boolean(saved.showWeekNumbers) : DEFAULT_CALENDAR_PREFS.showWeekNumbers,
    weekStartsOn: pick(WEEK_STARTS_ON, saved.weekStartsOn, DEFAULT_CALENDAR_PREFS.weekStartsOn),
    includeTimedTodos: saved.includeTimedTodos !== undefined ? Boolean(saved.includeTimedTodos) : DEFAULT_CALENDAR_PREFS.includeTimedTodos,
    customMeetingDomain: rawDomain,
    hiddenCalendars: normalizeNameList(saved.hiddenCalendars),
    noCountdownCalendars: normalizeNameList(saved.noCountdownCalendars),
    calendarColors: normalizeColorMap(saved.calendarColors),
  };
}
