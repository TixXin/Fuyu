import type { ServiceDefinition } from "../define.mjs";

export type TodoPriority = "high" | "medium" | "low";
export type TodoColor = "red" | "orange" | "yellow" | "green" | "blue" | "purple";

export type TodoEntry = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
  project?: string;
  startedAt?: number;
  priority?: TodoPriority;
  color?: TodoColor;
  /** Optional due date (`YYYY-MM-DD`) separate from the day the todo is scheduled on. */
  deadline?: string;
  /** Logical date (`YYYY-MM-DD`) when this todo first appeared before being carried over. */
  carriedFrom?: string;
  /** Minutes of focus recorded on this todo for its day; missing when there are none. A todo carried over to the next day starts again without it. */
  focusMinutes?: number;
  /** The todo's note, when it has one. */
  note?: string;
  updatedAt?: string;
  deviceId?: string;
};

export type ScheduledTodoEntry = {
  id: string;
  title: string;
  date: string;
  createdAt: number;
  project?: string;
  priority?: TodoPriority;
  color?: TodoColor;
  /** Optional due date (`YYYY-MM-DD`). */
  deadline?: string;
  updatedAt?: string;
  deviceId?: string;
};

export type TodosDay = {
  date: string;
  todos: TodoEntry[];
  scheduled: ScheduledTodoEntry[];
  activeTodoId: string | null;
  archived?: boolean;
};

export type TodosDaySummary = {
  date: string;
  total: number;
  completed: number;
  hasNote: boolean;
  archived: boolean;
};

export type TodosNote = { date: string; note: string; archived?: boolean };

export type TodosErrorCode = "bad-params" | "not-found" | "unavailable";

export type TodosMethods = {
  list(params: { date?: string }): TodosDay;
  days(params: { from: string; to: string }): { days: TodosDaySummary[] };
  /** `note` (at most 1000 characters) becomes the todo's note; a todo for a later day ignores it. `deadline` (`YYYY-MM-DD`) sets an optional due date. */
  add(params: { title: string; date?: string; project?: string; note?: string; deadline?: string }): TodoEntry | ScheduledTodoEntry;
  /**
   * `addFocusMinutes` (a whole number from 1 to 600) adds focus time that just ended to the todo. The todo never gains more
   * minutes than have passed since focus time was last added to it, so two timers running on the same todo do not count twice;
   * the returned `focusMinutes` says what it holds now. `deadline` (`YYYY-MM-DD` or `null` to clear) updates the todo's due date.
   */
  update(params: { id: string; title?: string; completed?: boolean; addFocusMinutes?: number; deadline?: string | null }): TodoEntry;
  remove(params: { id: string }): { id: string };
  note(params: { date?: string }): TodosNote;
  setNote(params: { note: string } | { append: string }): TodosNote;
};

export type TodosEvents = { changed: { date: string } };

export const todosV1: ServiceDefinition<TodosMethods, TodosEvents, {}>;
