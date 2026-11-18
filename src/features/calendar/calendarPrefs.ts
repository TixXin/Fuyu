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

export type CalendarPrefs = {
  countdownScope: CountdownScope;
  countdownFormat: CountdownFormat;
  holdMinutes: CalendarHoldMinutes;
  bannerEnabled: boolean;
  bannerMinutes: CalendarBannerMinutes;
  pauseMediaOnJoin: boolean;
  agendaRange: AgendaRange;
  hideDeclined: boolean;
  ignoreFreeInCountdown: boolean;
  foldAllDay: boolean;
  showWeekNumbers: boolean;
  weekStartsOn: WeekStartsOn;
  includeTimedTodos: boolean;
  customMeetingDomain: string;
};

export const DEFAULT_CALENDAR_PREFS: CalendarPrefs = {
  countdownScope: "all",
  countdownFormat: "titleMinutes",
  holdMinutes: 5,
  bannerEnabled: true,
  bannerMinutes: 1,
  pauseMediaOnJoin: true,
  agendaRange: "twoDays",
  hideDeclined: true,
  ignoreFreeInCountdown: true,
  foldAllDay: false,
  showWeekNumbers: false,
  weekStartsOn: "auto",
  includeTimedTodos: true,
  customMeetingDomain: "",
};

const DOMAIN_HOST = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(?::(\d{1,5}))?$/;
const HTTPS_URLS = /https:\/\/[^\s<>"')\]}，。；！）】]+/giu;
const TRAILING_PUNCT = /[.,;:!?)'"\]}]+$/;

function pick<T>(allowed: readonly T[], value: unknown, fallback: T): T {
  return (allowed as readonly unknown[]).includes(value) ? (value as T) : fallback;
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
  prefs: Pick<CalendarPrefs, "hideDeclined" | "customMeetingDomain">,
): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const event of events) {
    if (prefs.hideDeclined && event.declined === true) continue;
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
    pauseMediaOnJoin: saved.pauseMediaOnJoin !== undefined ? Boolean(saved.pauseMediaOnJoin) : DEFAULT_CALENDAR_PREFS.pauseMediaOnJoin,
    agendaRange: pick(AGENDA_RANGES, saved.agendaRange, DEFAULT_CALENDAR_PREFS.agendaRange),
    hideDeclined: saved.hideDeclined !== undefined ? Boolean(saved.hideDeclined) : DEFAULT_CALENDAR_PREFS.hideDeclined,
    ignoreFreeInCountdown: saved.ignoreFreeInCountdown !== undefined ? Boolean(saved.ignoreFreeInCountdown) : DEFAULT_CALENDAR_PREFS.ignoreFreeInCountdown,
    foldAllDay: saved.foldAllDay !== undefined ? Boolean(saved.foldAllDay) : DEFAULT_CALENDAR_PREFS.foldAllDay,
    showWeekNumbers: saved.showWeekNumbers !== undefined ? Boolean(saved.showWeekNumbers) : DEFAULT_CALENDAR_PREFS.showWeekNumbers,
    weekStartsOn: pick(WEEK_STARTS_ON, saved.weekStartsOn, DEFAULT_CALENDAR_PREFS.weekStartsOn),
    includeTimedTodos: saved.includeTimedTodos !== undefined ? Boolean(saved.includeTimedTodos) : DEFAULT_CALENDAR_PREFS.includeTimedTodos,
    customMeetingDomain: rawDomain,
  };
}
