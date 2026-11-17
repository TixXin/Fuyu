import { calendarV1, type CalendarEvents } from "@fuyu/plugin-services";
import { useCallback, useEffect, useMemo, useState } from "react";
import { visibilityInterval } from "../../lib/useVisibilityInterval";
import { windowServices } from "../plugin-kernel/services";
import type { CalendarEvent, CalendarSnapshot } from "./api";
import { subscribeCalendarSources } from "./plugin/services";
import { nextChangeAt, upcomingMeeting, type UpcomingMeeting } from "./upcoming";

const POLL_MS = 60_000;
const calendar = windowServices.get(calendarV1);

const NO_EVENTS: readonly CalendarEvent[] = [];

export const EMPTY_CALENDAR: CalendarSnapshot = { events: [], problems: [], fetchedAt: 0, fromMs: 0, toMs: 0, sourceCount: 0 };

function toSnapshot(value: CalendarEvents | null | undefined): CalendarSnapshot {
  if (!value || !Array.isArray(value.events) || !Array.isArray(value.problems) || typeof value.sourceCount !== "number") {
    return EMPTY_CALENDAR;
  }
  return {
    events: value.events,
    problems: value.problems.map((problem) => ({
      sourceId: problem.sourceId,
      message: problem.reason && problem.reason !== "failed" ? { code: problem.reason, message: problem.message } : problem.message,
    })),
    fetchedAt: value.fetchedAt,
    fromMs: value.fromMs,
    toMs: value.toMs,
    sourceCount: value.sourceCount,
  };
}

export type CalendarState = {
  snapshot: CalendarSnapshot;
  upcoming: UpcomingMeeting | null;
  now: number;
  refresh: () => void;
};

export function useCalendar(enabled: boolean, remindMinutes: number, extra: readonly CalendarEvent[] = NO_EVENTS): CalendarState {
  const [read, setSnapshot] = useState<CalendarSnapshot>(EMPTY_CALENDAR);
  const snapshot = useMemo(
    () => (enabled && extra.length > 0 ? { ...read, events: [...read.events, ...extra].sort((a, b) => a.startMs - b.startMs) } : read),
    [enabled, extra, read],
  );
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async (refresh: boolean) => {
    try {
      const next = await calendar.events({ refresh });
      setSnapshot(toSnapshot(next));
      setNow(Date.now());
    } catch (error) {
      console.error("Failed to read the calendars", error);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setSnapshot(EMPTY_CALENDAR);
      return;
    }
    void load(false);
    const offTimer = visibilityInterval(() => void load(false), POLL_MS);
    const offChanged = calendar.on("changed", () => void load(false));
    const offSources = subscribeCalendarSources(() => void load(false));
    const offWatch = windowServices.watch(() => void load(false));
    return () => {
      offTimer();
      void offChanged();
      offSources();
      offWatch();
    };
  }, [enabled, load]);

  useEffect(() => {
    const at = nextChangeAt(snapshot.events, now, remindMinutes);
    if (at === null) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(0, at - Date.now()) + 50);
    return () => window.clearTimeout(timer);
  }, [now, remindMinutes, snapshot.events]);

  const upcoming = useMemo(() => upcomingMeeting(snapshot.events, now, remindMinutes), [now, remindMinutes, snapshot.events]);
  const refresh = useCallback(() => void load(true), [load]);
  return useMemo(() => ({ snapshot, upcoming, now, refresh }), [now, refresh, snapshot, upcoming]);
}
