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
  update(params: { id: string; title?: string; completed?: boolean }): TodoEntry;
  remove(params: { id: string }): { id: string };
  note(params: { date?: string }): TodosNote;
  setNote(params: { note: string } | { append: string }): TodosNote;
};

export type TodosEvents = { changed: { date: string } };

export const todosV1: ServiceDefinition<TodosMethods, TodosEvents, {}>;
