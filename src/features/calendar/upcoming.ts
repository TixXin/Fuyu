import type { CalendarEvent } from "./api";
import {
  DEFAULT_CALENDAR_PREFS,
  withCalendarEventPrefs,
  type CalendarBannerMinutes,
  type CalendarHoldMinutes,
  type CountdownFormat,
  type CountdownScope,
} from "./calendarPrefs.ts";

export type UpcomingMeeting = {
  event: CalendarEvent;
  minutes: number;
  remainingEndMinutes?: number;
};

export type CollapsedMeeting = {
  upcoming: UpcomingMeeting;
  showTitle: boolean;
  format?: CountdownFormat;
  pauseMediaOnJoin?: boolean;
};

export type UpcomingOptions = {
  countdownScope?: CountdownScope;
  holdMinutes?: CalendarHoldMinutes;
  hideDeclined?: boolean;
  ignoreFreeInCountdown?: boolean;
  customMeetingDomain?: string;
  bannerEnabled?: boolean;
  bannerMinutes?: CalendarBannerMinutes;
  hiddenCalendars?: readonly string[];
  noCountdownCalendars?: readonly string[];
};

export type DueMeetingBanner = {
  id: string;
  event: CalendarEvent;
  minutes: number;
};

export type MeetingBannerPayload = {
  id: string;
  source: "calendar";
  icon: "bell";
  title: string;
  detail: string;
  meetingLink: string | null;
};

export const STARTED_HOLD_MS = 5 * 60_000;

export function holdEndMs(event: Pick<CalendarEvent, "startMs" | "endMs">, holdMinutes: CalendarHoldMinutes = DEFAULT_CALENDAR_PREFS.holdMinutes): number {
  if (holdMinutes === 0) return event.startMs;
  if (holdMinutes === -1) return event.endMs;
  return Math.min(event.endMs, event.startMs + holdMinutes * 60_000);
}

function isCalendarExcluded(
  calendarName: string,
  hiddenCalendars: readonly string[] | undefined,
  noCountdownCalendars: readonly string[] | undefined,
): boolean {
  const key = calendarName.trim();
  if (!key) return false;
  if (hiddenCalendars && hiddenCalendars.includes(key)) return true;
  if (noCountdownCalendars && noCountdownCalendars.includes(key)) return true;
  return false;
}

function resolveCandidate(
  event: CalendarEvent,
  hideDeclined: boolean,
  ignoreFree: boolean,
  customDomain: string,
  hiddenCalendars?: readonly string[],
  noCountdownCalendars?: readonly string[],
): CalendarEvent | null {
  if (event.allDay || event.endMs <= event.startMs) return null;
  if (hideDeclined && event.declined === true) return null;
  if (ignoreFree && event.free === true) return null;
  if (isCalendarExcluded(event.calendar, hiddenCalendars, noCountdownCalendars)) return null;
  return customDomain ? withCalendarEventPrefs(event, customDomain) : event;
}

export function upcomingMeeting(
  events: readonly CalendarEvent[],
  now: number,
  remindMinutes: number,
  options: UpcomingOptions = {},
): UpcomingMeeting | null {
  if (remindMinutes <= 0) return null;
  const countdownScope = options.countdownScope ?? DEFAULT_CALENDAR_PREFS.countdownScope;
  const holdMinutes = options.holdMinutes ?? DEFAULT_CALENDAR_PREFS.holdMinutes;
  const hideDeclined = options.hideDeclined ?? DEFAULT_CALENDAR_PREFS.hideDeclined;
  const ignoreFree = options.ignoreFreeInCountdown ?? DEFAULT_CALENDAR_PREFS.ignoreFreeInCountdown;
  const customDomain = options.customMeetingDomain ?? DEFAULT_CALENDAR_PREFS.customMeetingDomain;
  const window = remindMinutes * 60_000;
  const candidates: CalendarEvent[] = [];
  for (const raw of events) {
    const event = resolveCandidate(raw, hideDeclined, ignoreFree, customDomain, options.hiddenCalendars, options.noCountdownCalendars);
    if (!event) continue;
    if (countdownScope === "meetingsOnly" && !event.meetingLink) continue;
    if (event.startMs - now <= window && now < holdEndMs(event, holdMinutes)) {
      candidates.push(event);
    }
  }
  const soonest =
    candidates.filter((event) => event.startMs > now).sort((a, b) => a.startMs - b.startMs)[0] ??
    candidates.sort((a, b) => b.startMs - a.startMs)[0];
  if (!soonest) return null;
  if (soonest.startMs > now) {
    return { event: soonest, minutes: Math.max(1, Math.ceil((soonest.startMs - now) / 60_000)) };
  }
  if (holdMinutes === -1) {
    return {
      event: soonest,
      minutes: 0,
      remainingEndMinutes: Math.max(1, Math.ceil((soonest.endMs - now) / 60_000)),
    };
  }
  return { event: soonest, minutes: 0 };
}

export function nextChangeAt(
  events: readonly CalendarEvent[],
  now: number,
  remindMinutes: number,
  options: UpcomingOptions = {},
): number | null {
  const bannerEnabled = options.bannerEnabled === true;
  if (remindMinutes <= 0 && !bannerEnabled) return null;
  const countdownScope = options.countdownScope ?? DEFAULT_CALENDAR_PREFS.countdownScope;
  const holdMinutes = options.holdMinutes ?? DEFAULT_CALENDAR_PREFS.holdMinutes;
  const hideDeclined = options.hideDeclined ?? DEFAULT_CALENDAR_PREFS.hideDeclined;
  const ignoreFree = options.ignoreFreeInCountdown ?? DEFAULT_CALENDAR_PREFS.ignoreFreeInCountdown;
  const customDomain = options.customMeetingDomain ?? DEFAULT_CALENDAR_PREFS.customMeetingDomain;
  const bannerMinutes = options.bannerMinutes ?? DEFAULT_CALENDAR_PREFS.bannerMinutes;
  const window = remindMinutes * 60_000;
  const bannerLead = bannerMinutes * 60_000;
  const times: number[] = [];
  for (const raw of events) {
    const event = resolveCandidate(raw, hideDeclined, ignoreFree, customDomain, options.hiddenCalendars, options.noCountdownCalendars);
    if (!event) continue;
    if (remindMinutes > 0 && (countdownScope !== "meetingsOnly" || Boolean(event.meetingLink))) {
      times.push(event.startMs - window, event.startMs, holdEndMs(event, holdMinutes), event.endMs);
    }
    if (bannerEnabled) {
      times.push(event.startMs - bannerLead, event.startMs, Math.min(event.endMs, event.startMs + STARTED_HOLD_MS));
    }
  }
  const future = times.filter((at) => at > now);
  const soonest = future.length > 0 ? Math.min(...future) : null;
  const showing = remindMinutes > 0 ? upcomingMeeting(events, now, remindMinutes, options) : null;
  let nextMinute: number | null = null;
  if (showing && showing.minutes > 0) {
    nextMinute = now + (((showing.event.startMs - now) % 60_000) || 60_000);
  } else if (showing && showing.remainingEndMinutes !== undefined) {
    nextMinute = now + (((showing.event.endMs - now) % 60_000) || 60_000);
  }
  const all = [soonest, nextMinute].filter((at): at is number => at !== null);
  return all.length > 0 ? Math.min(...all) : null;
}

export function meetingBannerId(event: Pick<CalendarEvent, "uid" | "startMs">): string {
  return `calendar-meeting:${event.uid}:${event.startMs}`;
}

export function dueMeetingBanner(
  events: readonly CalendarEvent[],
  now: number,
  options: Pick<UpcomingOptions, "bannerEnabled" | "bannerMinutes" | "hideDeclined" | "ignoreFreeInCountdown" | "customMeetingDomain" | "hiddenCalendars" | "noCountdownCalendars">,
  reminded: ReadonlySet<string>,
): DueMeetingBanner | null {
  if (options.bannerEnabled === false) return null;
  const bannerMinutes = options.bannerMinutes ?? DEFAULT_CALENDAR_PREFS.bannerMinutes;
  const hideDeclined = options.hideDeclined ?? DEFAULT_CALENDAR_PREFS.hideDeclined;
  const ignoreFree = options.ignoreFreeInCountdown ?? DEFAULT_CALENDAR_PREFS.ignoreFreeInCountdown;
  const customDomain = options.customMeetingDomain ?? DEFAULT_CALENDAR_PREFS.customMeetingDomain;
  const lead = bannerMinutes * 60_000;
  const due: CalendarEvent[] = [];
  for (const raw of events) {
    const event = resolveCandidate(raw, hideDeclined, ignoreFree, customDomain, options.hiddenCalendars, options.noCountdownCalendars);
    if (!event) continue;
    const id = meetingBannerId(event);
    if (reminded.has(id)) continue;
    const latest = Math.min(event.endMs, event.startMs + STARTED_HOLD_MS);
    if (now >= event.startMs - lead && now < latest) {
      due.push(event);
    }
  }
  due.sort((a, b) => a.startMs - b.startMs);
  const first = due[0];
  if (!first) return null;
  return {
    id: meetingBannerId(first),
    event: first,
    minutes: first.startMs > now ? Math.max(1, Math.ceil((first.startMs - now) / 60_000)) : 0,
  };
}

export function formatMeetingBanner(
  banner: DueMeetingBanner,
  showTitle: boolean,
  copy: { meeting: string; inMinutes: (minutes: number) => string; started: string },
): MeetingBannerPayload {
  return {
    id: banner.id,
    source: "calendar",
    icon: "bell",
    title: showTitle && banner.event.title ? banner.event.title : copy.meeting,
    detail: banner.minutes > 0 ? copy.inMinutes(banner.minutes) : copy.started,
    meetingLink: banner.event.meetingLink,
  };
}

export function clockTime(ms: number) {
  const date = new Date(ms);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
