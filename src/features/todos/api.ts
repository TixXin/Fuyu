import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { ScheduledTodo, TodoArchive, TodoItem } from "./types";

export type SaveTodoResult = {
  filePath: string;
};

export function saveTodoMarkdown(directory: string, date: string, content: string) {
  return invoke<SaveTodoResult>("save_todo_markdown", { directory, date, content });
}

export function getDefaultTodoSaveDirectory() {
  return invoke<string>("get_default_todo_save_directory");
}

export function getLegacyTodoSaveDirectory() {
  return invoke<string>("get_legacy_todo_save_directory");
}

export type TodosData = {
  date: string;
  todos: TodoItem[];
  scheduled: ScheduledTodo[];
  archives: TodoArchive[];
  dailyNote: string;
  activeTodoId: string | null;
};

export type LocalTodoKeys = {
  "focusd-island-todos": string | null;
  "focusd-island-archives": string | null;
  "focusd-island-scheduled-todos": string | null;
  "focusd-island-daily-note": string | null;
  "focusd-island-active-todo": string | null;
  "focusd-island-current-date": string | null;
};

export type TodosSnapshot = {
  revision: number;
  data: TodosData;
  notice: "reimported" | null;
};

export type TodosChange = Partial<TodosData> & {
  baseRevision?: number;
};

export type AppliedTodosChange = {
  revision: number;
  conflicts: (keyof TodosData)[];
  data: TodosData | null;
};

const TODOS_CHANGED_EVENT = "todos-changed";
export type TodosChangedPayload = {
  revision: number;
  data: TodosData;
  fields: (keyof TodosData)[];
  reason: string | null;
};

export function listenTodosChanged(onChange: (payload: TodosChangedPayload) => void) {
  return listen<TodosChangedPayload>(TODOS_CHANGED_EVENT, (event) => onChange(event.payload));
}

export function migrateTodos(keys: LocalTodoKeys, normalized: TodosData) {
  return invoke<TodosSnapshot>("migrate_todos", { keys, normalized });
}

export function getTodosState() {
  return invoke<TodosSnapshot>("get_todos_state");
}

export function applyTodosChange(change: TodosChange) {
  return invoke<AppliedTodosChange>("apply_todos_change", { change });
}
