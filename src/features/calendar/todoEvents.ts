import type { CalendarEvent } from "./api";

/** A todo with no end time is taken as a half-hour meeting. */
const DEFAULT_LENGTH_MS = 30 * 60_000;

/** "15:00 周会", "9:30-10:00 站会", "14：00～15：30 评审": a time (and maybe an end) before the title. */
const LEADING_TIME = /^\s*(\d{1,2})[:：](\d{2})(?:\s*[-~～–—]\s*(\d{1,2})[:：](\d{2}))?\s+(.+)$/u;

/**
 * Today's unfinished todos whose title starts with a time, as calendar events, so the collapsed
 * island counts down to them like meetings with no calendar added. The time is local, today; a
 * join link in the title is kept. Nothing about the todos themselves changes.
 */
export function todoEvents(todos: readonly { id: string; title: string; completed: boolean }[], now: number, calendarName: string): CalendarEvent[] {
  return todos.flatMap((todo) => {
    if (todo.completed) return [];
    const event = timedEvent(`todo:${todo.id}`, todo.title, now, calendarName);
    return event ? [event] : [];
  });
}

/** `uid` of the events below: the calendar page marks them as todos. */
export const SCHEDULED_TODO_UID = "scheduled:";

/**
 * Todos planned for later days (useScheduledTodos), shown on the calendar page (issue #43): a
 * title starting with a time as that time on its day, others as an all-day line. They are not
 * reminders: on their day they join today's list, and todoEvents takes them from there.
 */
export function scheduledTodoEvents(todos: readonly { id: string; title: string; date: string }[], calendarName: string): CalendarEvent[] {
  return todos.flatMap((todo) => {
    const [year, month, day] = todo.date.split("-").map(Number);
    if (!year || !month || !day) return [];
    const start = new Date(year, month - 1, day).getTime();
    const uid = `${SCHEDULED_TODO_UID}${todo.id}`;
    return [timedEvent(uid, todo.title, start, calendarName) ?? {
      uid, title: todo.title, startMs: start, endMs: new Date(year, month - 1, day + 1).getTime(),
      allDay: true, location: null, meetingLink: null, calendar: calendarName,
    }];
  });
}

/** The event a title starting with a time stands for, on the day `day` is in; null for other titles. */
function timedEvent(uid: string, text: string, day: number, calendarName: string): CalendarEvent | null {
  const match = LEADING_TIME.exec(text);
  if (!match) return null;
  const [hours, minutes] = [Number(match[1]), Number(match[2])];
  if (hours > 23 || minutes > 59) return null;
  const start = new Date(day);
  start.setHours(hours, minutes, 0, 0);
  let endMs = start.getTime() + DEFAULT_LENGTH_MS;
  if (match[3] !== undefined) {
    const end = new Date(day);
    end.setHours(Number(match[3]), Number(match[4]), 0, 0);
    if (end.getTime() > start.getTime() && Number(match[3]) <= 23 && Number(match[4]) <= 59) endMs = end.getTime();
  }
  const link = /https:\/\/\S+/u.exec(match[5])?.[0] ?? null;
  const title = match[5].replace(/https:\/\/\S+/gu, "").trim() || match[5].trim();
  return { uid, title, startMs: start.getTime(), endMs, allDay: false, location: null, meetingLink: link, calendar: calendarName };
}
