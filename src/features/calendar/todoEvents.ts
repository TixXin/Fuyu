import type { CalendarEvent } from "./api";

const DEFAULT_LENGTH_MS = 30 * 60_000;

const LEADING_TIME = /^\s*(\d{1,2})[:：](\d{2})(?:\s*[-~～–—]\s*(\d{1,2})[:：](\d{2}))?\s+(.+)$/u;

export function todoEvents(todos: readonly { id: string; title: string; completed: boolean }[], now: number, calendarName: string): CalendarEvent[] {
  return todos.flatMap((todo) => {
    if (todo.completed) return [];
    const event = timedEvent(`todo:${todo.id}`, todo.title, now, calendarName);
    return event ? [event] : [];
  });
}

export const SCHEDULED_TODO_UID = "scheduled:";

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
