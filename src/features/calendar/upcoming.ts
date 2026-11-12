import type { CalendarEvent } from "./api";

export type UpcomingMeeting = {
  event: CalendarEvent;
  minutes: number;
};

export type CollapsedMeeting = { upcoming: UpcomingMeeting; showTitle: boolean };

export const STARTED_HOLD_MS = 5 * 60_000;

export function upcomingMeeting(events: readonly CalendarEvent[], now: number, remindMinutes: number): UpcomingMeeting | null {
  if (remindMinutes <= 0) return null;
  const window = remindMinutes * 60_000;
  const candidates = events.filter(
    (event) => !event.allDay && event.endMs > event.startMs && event.startMs - now <= window && now - event.startMs < STARTED_HOLD_MS && now < event.endMs,
  );
  const soonest =
    candidates.filter((event) => event.startMs > now).sort((a, b) => a.startMs - b.startMs)[0] ??
    candidates.sort((a, b) => b.startMs - a.startMs)[0];
  if (!soonest) return null;
  return { event: soonest, minutes: soonest.startMs > now ? Math.max(1, Math.ceil((soonest.startMs - now) / 60_000)) : 0 };
}

export function nextChangeAt(events: readonly CalendarEvent[], now: number, remindMinutes: number): number | null {
  if (remindMinutes <= 0) return null;
  const window = remindMinutes * 60_000;
  const times = events
    .filter((event) => !event.allDay)
    .flatMap((event) => [event.startMs - window, event.startMs, event.startMs + STARTED_HOLD_MS, event.endMs])
    .filter((at) => at > now);
  const soonest = times.length > 0 ? Math.min(...times) : null;
  const showing = upcomingMeeting(events, now, remindMinutes);
  const nextMinute = showing && showing.minutes > 0 ? now + (((showing.event.startMs - now) % 60_000) || 60_000) : null;
  const all = [soonest, nextMinute].filter((at): at is number => at !== null);
  return all.length > 0 ? Math.min(...all) : null;
}

export function clockTime(ms: number) {
  const date = new Date(ms);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
