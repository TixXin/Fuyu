import { useMemo } from "react";
import { useTranslation } from "../../../i18n";
import type { IslandContribution } from "../../plugin-kernel/islandContributions";
import { defineSlot } from "../../plugin-kernel/slots";
import { useIslandContributions } from "../../plugin-kernel/useIslandContributions";
import { todoEvents } from "../todoEvents";
import { useCalendar } from "../useCalendar";
import { useCalendarPrefs } from "../useCalendarPrefs";
import { useMeetingBanner } from "../useMeetingBanner";
import { useTodoLink } from "../useTodoLink";
import { calendarState, meetingBannerState, meetingState, todoLinkState } from "./islandState";
import { useMeetingContributions } from "./meetingLines";
import { OWNER } from "./owner.ts";

type RunnerProps = {
  barText: boolean;
  settings: { todoEnabled: boolean; calendarEnabled: boolean; calendarRemindMinutes: number; calendarShowTitle: boolean };
};

const runnerSlot = defineSlot<RunnerProps>("island.runner/v1");

function CalendarRunner({ barText, settings }: RunnerProps) {
  const t = useTranslation();
  const [prefs] = useCalendarPrefs();
  const link = useTodoLink(settings.todoEnabled);
  todoLinkState.useProvide(link);
  const todos = link?.todos;
  const timedTodos = useMemo(
    () => (todos && prefs.includeTimedTodos ? todoEvents(todos, Date.now(), t.island.todoList) : []),
    [prefs.includeTimedTodos, t, todos],
  );
  const calendar = useCalendar(settings.calendarEnabled, settings.calendarRemindMinutes, timedTodos, prefs);
  calendarState.useProvide(calendar);
  const { upcoming } = calendar;
  const meeting = useMemo(
    () =>
      upcoming && settings.calendarEnabled
        ? {
            upcoming,
            showTitle: settings.calendarShowTitle,
            format: prefs.countdownFormat,
            pauseMediaOnJoin: prefs.pauseMediaOnJoin,
          }
        : null,
    [prefs.countdownFormat, prefs.pauseMediaOnJoin, settings.calendarEnabled, settings.calendarShowTitle, upcoming],
  );
  meetingState.useProvide(meeting);
  const banner = useMeetingBanner(settings.calendarEnabled, calendar.snapshot.events, calendar.now, prefs, settings.calendarShowTitle);
  meetingBannerState.useProvide(banner);
  const lineContributions = useMeetingContributions(meeting, barText);
  const contributions = useMemo<IslandContribution[]>(() => {
    if (!banner) return lineContributions;
    return [...lineContributions, { kind: "notice", item: "calendar.banner" }, { kind: "reveal", reveal: "allowed" }];
  }, [banner, lineContributions]);
  useIslandContributions(OWNER, "calendar.meeting", contributions);
  return null;
}

runnerSlot.add({ id: "calendar.runner", component: CalendarRunner }, OWNER);
