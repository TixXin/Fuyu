import type { ScheduledTodo, TodoArchive, TodoItem } from "./types";

export type HistoryState = {
  date: string;
  todos: TodoItem[];
  scheduledTodos: ScheduledTodo[];
  dailyNote: string;
  archives: TodoArchive[];
};

export type HistoryAnswer = { ok: true; data: unknown } | { ok: false; status: 400 | 404; error: string };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ok = (data: unknown): HistoryAnswer => ({ ok: true, data });
const fail = (status: 400 | 404, error: string): HistoryAnswer => ({ ok: false, status, error });
const noArchive = (date: string) => fail(404, `Nothing was archived for ${date}.`);

function askedDate(value: unknown, state: HistoryState): string | null | HistoryAnswer {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return fail(400, `"date" must look like YYYY-MM-DD.`);
  return value === state.date ? null : value;
}

export function listDay(value: unknown, state: HistoryState): HistoryAnswer | null {
  const date = askedDate(value, state);
  if (date === null || typeof date !== "string") return date;
  if (date > state.date) {
    return ok({ date, todos: [], scheduled: state.scheduledTodos.filter((todo) => todo.date === date), activeTodoId: null });
  }
  const archive = state.archives.find((item) => item.date === date);
  return archive ? ok({ date, todos: archive.todos, scheduled: [], activeTodoId: null, archived: true }) : noArchive(date);
}

export function noteOfDay(value: unknown, state: HistoryState): HistoryAnswer | null {
  const date = askedDate(value, state);
  if (date === null || typeof date !== "string") return date;
  if (date > state.date) return fail(400, "A note exists only for today and archived days.");
  const archive = state.archives.find((item) => item.date === date);
  return archive ? ok({ date, note: archive.dailyNote, archived: true }) : noArchive(date);
}

export function daysBetween(from: unknown, to: unknown, state: HistoryState): HistoryAnswer {
  if (typeof from !== "string" || !DATE_PATTERN.test(from) || typeof to !== "string" || !DATE_PATTERN.test(to)) {
    return fail(400, "Send { from, to } as YYYY-MM-DD dates.");
  }
  if (from > to) return fail(400, `"from" must not be after "to".`);
  const inRange = (date: string) => from <= date && date <= to;
  const summary = (date: string, todos: TodoItem[], note: string, archived: boolean) => ({
    date,
    total: todos.length,
    completed: todos.filter((todo) => todo.completed).length,
    hasNote: note.trim() !== "",
    archived,
  });
  const days = state.archives
    .filter((archive) => inRange(archive.date) && archive.date !== state.date)
    .map((archive) => summary(archive.date, archive.todos, archive.dailyNote, true));
  if (inRange(state.date)) days.push(summary(state.date, state.todos, state.dailyNote, false));
  days.sort((left, right) => left.date.localeCompare(right.date));
  return ok({ days: days.filter((day, index) => index === 0 || days[index - 1].date !== day.date) });
}
