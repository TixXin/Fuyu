import { invoke } from "@tauri-apps/api/core";
import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
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
  dailyNoteUpdatedAt?: string;
  tombstones?: TodoTombstone[];
};

export type TodoTombstone = {
  id: string;
  deletedAt: string;
  deviceId: string;
};

export type LocalTodoKeys = {
  "focusd-island-todos": string | null;
  "focusd-island-archives": string | null;
  "focusd-island-scheduled-todos": string | null;
  "focusd-island-daily-note": string | null;
  "focusd-island-active-todo": string | null;
  "focusd-island-current-date": string | null;
  "fuyu-todos-migrated-v1"?: string | null;
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

const PLUGIN_HOST_EVENT = "plugin-host-event";
export type TodoHostEventName = "todos.changed" | "note.changed";

export function emitTodoHostEvent(name: TodoHostEventName, payload: Record<string, unknown>) {
  return emit(PLUGIN_HOST_EVENT, { name, payload });
}

export const TODO_QUICK_ADD_SHORTCUT_EVENT = "todo-quick-add-shortcut";
export const TODO_SHORTCUT_STATUS_EVENT = "todo-shortcut-status";

export type TodoShortcutProblem = "invalid" | "taken";

export function listenTodoQuickAddShortcut(handler: () => void): Promise<UnlistenFn> {
  return listen(TODO_QUICK_ADD_SHORTCUT_EVENT, () => handler());
}

export function getTodoShortcutProblem(): Promise<TodoShortcutProblem | null> {
  return invoke<TodoShortcutProblem | null>("get_todo_shortcut_problem");
}

export function listenTodoShortcutProblem(handler: (problem: TodoShortcutProblem | null) => void): Promise<UnlistenFn> {
  return listen<TodoShortcutProblem | null>(TODO_SHORTCUT_STATUS_EVENT, ({ payload }) => handler(payload));
}
