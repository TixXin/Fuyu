import { calendarV1, type CalendarEvents } from "@fuyu/plugin-services";
import { isNativeError, type NativeError } from "../../i18n/nativeError";
import { useCallback, useEffect, useMemo, useState } from "react";
import { visibilityInterval } from "../../lib/useVisibilityInterval";
import { windowServices } from "../plugin-kernel/services";
import type { CalendarEvent, CalendarSnapshot } from "./api";
import { DEFAULT_CALENDAR_PREFS, prepareCalendarEvents, type CalendarPrefs } from "./calendarPrefs";
import { subscribeCalendarSources } from "./plugin/services";
import { CALENDAR_REFRESH_KEY } from "./storage";
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
    events: value.events as CalendarEvent[],
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

async function namedProblems(snapshot: CalendarSnapshot): Promise<CalendarSnapshot> {
  if (snapshot.problems.length === 0) return snapshot;
  const listed = await calendar.sources().catch(() => null);
  const names = new Map((listed?.sources ?? []).map((source) => [source.id, source.name]));
  return { ...snapshot, problems: snapshot.problems.map((problem) => ({ ...problem, name: names.get(problem.sourceId) })) };
}

type ServiceErrorData = { reason?: unknown; args?: NativeError["args"]; detail?: unknown };

function failureOf(error: unknown): NativeError | string {
  const data = error && typeof error === "object" ? (error as { data?: ServiceErrorData }).data : undefined;
  const message = isNativeError(error) ? error.message : error instanceof Error ? error.message : String(error);
  if (typeof data?.reason === "string" && data.reason.includes(".")) {
    return { code: data.reason, message, args: data.args, detail: typeof data.detail === "string" ? data.detail : undefined };
  }
  if (isNativeError(error) && error.code.includes(".")) return error;
  return message;
}

export type CalendarState = {
  snapshot: CalendarSnapshot;
  failure: NativeError | string | null;
  upcoming: UpcomingMeeting | null;
  now: number;
  refresh: () => void;
};

export function useCalendar(
  enabled: boolean,
  remindMinutes: number,
  extra: readonly CalendarEvent[] = NO_EVENTS,
  prefs: CalendarPrefs = DEFAULT_CALENDAR_PREFS,
): CalendarState {
  const [read, setSnapshot] = useState<CalendarSnapshot>(EMPTY_CALENDAR);
  const snapshot = useMemo(() => {
    if (!enabled) return read;
    const merged = extra.length > 0 ? [...read.events, ...extra].sort((a, b) => a.startMs - b.startMs) : read.events;
    return { ...read, events: prepareCalendarEvents(merged, prefs) };
  }, [enabled, extra, prefs, read]);
  const [now, setNow] = useState(() => Date.now());
  const [failure, setFailure] = useState<NativeError | string | null>(null);

  const load = useCallback(async (refresh: boolean) => {
    try {
      const next = await namedProblems(toSnapshot(await calendar.events({ refresh })));
      setSnapshot(next);
      setFailure(null);
      setNow(Date.now());
    } catch (error) {
      console.error("Failed to read the calendars", error);
      setFailure(failureOf(error));
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setSnapshot(EMPTY_CALENDAR);
      setFailure(null);
      return;
    }
    void load(false);
    const offTimer = visibilityInterval(() => void load(false), POLL_MS);
    const offChanged = calendar.on("changed", () => void load(false));
    const offSources = subscribeCalendarSources(() => void load(false));
    const offWatch = windowServices.watch(() => void load(false));
    const onStorage = (event: StorageEvent) => {
      if (event.key === CALENDAR_REFRESH_KEY) void load(false);
    };
    window.addEventListener("storage", onStorage);
    return () => {
      offTimer();
      void offChanged();
      offSources();
      offWatch();
      window.removeEventListener("storage", onStorage);
    };
  }, [enabled, load]);

  useEffect(() => {
    const at = nextChangeAt(snapshot.events, now, remindMinutes, prefs);
    if (at === null) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(0, at - Date.now()) + 50);
    return () => window.clearTimeout(timer);
  }, [now, prefs, remindMinutes, snapshot.events]);

  const upcoming = useMemo(
    () => upcomingMeeting(snapshot.events, now, remindMinutes, prefs),
    [now, prefs, remindMinutes, snapshot.events],
  );
  const refresh = useCallback(() => void load(true), [load]);
  return useMemo(() => ({ snapshot, failure, upcoming, now, refresh }), [failure, now, refresh, snapshot, upcoming]);
}
