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
  /** Minutes of focus recorded on this todo for its day; missing when there are none. A todo carried over to the next day starts again without it. */
  focusMinutes?: number;
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
  add(params: { title: string; date?: string; project?: string }): TodoEntry | ScheduledTodoEntry;
  /**
   * `addFocusMinutes` (a whole number from 1 to 600) adds focus time that just ended to the todo. The todo never gains more
   * minutes than have passed since focus time was last added to it, so two timers running on the same todo do not count twice;
   * the returned `focusMinutes` says what it holds now. Fuyu before 0.3.11 ignores the field.
   */
  update(params: { id: string; title?: string; completed?: boolean; addFocusMinutes?: number }): TodoEntry;
  remove(params: { id: string }): { id: string };
  note(params: { date?: string }): TodosNote;
  setNote(params: { note: string } | { append: string }): TodosNote;
};

export type TodosEvents = { changed: { date: string } };

export const todosV1: ServiceDefinition<TodosMethods, TodosEvents, {}>;
