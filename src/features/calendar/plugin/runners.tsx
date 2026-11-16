import { useMemo } from "react";
import { useTranslation } from "../../../i18n";
import { defineSlot } from "../../plugin-kernel/slots";
import { useIslandContributions } from "../../plugin-kernel/useIslandContributions";
import { todoEvents } from "../todoEvents";
import { useCalendar } from "../useCalendar";
import { useTodoLink } from "../useTodoLink";
import { calendarState, meetingState, todoLinkState } from "./islandState";
import { useMeetingContributions } from "./meetingLines";
import { OWNER } from "./owner.ts";

type RunnerProps = {
  barText: boolean;
  settings: { todoEnabled: boolean; calendarEnabled: boolean; calendarRemindMinutes: number; calendarShowTitle: boolean };
};

const runnerSlot = defineSlot<RunnerProps>("island.runner/v1");

function CalendarRunner({ barText, settings }: RunnerProps) {
  const t = useTranslation();
  const link = useTodoLink(settings.todoEnabled);
  todoLinkState.useProvide(link);
  const todos = link?.todos;
  const timedTodos = useMemo(() => (todos ? todoEvents(todos, Date.now(), t.island.todoList) : []), [t, todos]);
  const calendar = useCalendar(settings.calendarEnabled, settings.calendarRemindMinutes, timedTodos);
  calendarState.useProvide(calendar);
  const { upcoming } = calendar;
  const meeting = useMemo(() => (upcoming && settings.calendarEnabled ? { upcoming, showTitle: settings.calendarShowTitle } : null), [upcoming, settings.calendarEnabled, settings.calendarShowTitle]);
  meetingState.useProvide(meeting);
  useIslandContributions(OWNER, "calendar.meeting", useMeetingContributions(meeting, barText));
  return null;
}

runnerSlot.add({ id: "calendar.runner", component: CalendarRunner }, OWNER);
