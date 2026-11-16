import { createRunnerStore } from "../../plugin-kernel/runnerStore";
import type { CollapsedMeeting } from "../upcoming";
import type { CalendarState } from "../useCalendar";

export const calendarState = createRunnerStore<CalendarState | null>(null);
export const meetingState = createRunnerStore<CollapsedMeeting | null>(null);
