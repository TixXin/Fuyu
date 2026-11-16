import { createRunnerStore } from "../../plugin-kernel/runnerStore";
import type { CollapsedMeeting } from "../upcoming";
import type { CalendarState } from "../useCalendar";
import type { TodoLink } from "../useTodoLink";

export const calendarState = createRunnerStore<CalendarState | null>(null);
export const todoLinkState = createRunnerStore<TodoLink | null>(null);
export const meetingState = createRunnerStore<CollapsedMeeting | null>(null);
