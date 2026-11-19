import type { LocalTodoKeys, TodosData } from "./api";
import type { ScheduledTodo, TodoArchive, TodoItem, TodoSubtask } from "./types";
import type { FocusCreditKind } from "./useTodoFocusTimer.ts";
import { getLocalDateString } from "../../utils/date.ts";
import { isInProgress, withoutStart } from "./activeTodos.ts";
import { readProject } from "./project.ts";
import { normalizeScheduledTodo, sortScheduledTodos } from "./schedule.ts";
import { readTags } from "./tags.ts";
import { getLogicalTodoDate } from "./todoPrefs.ts";

export const MAX_TODO_SUBTASKS = 50;
export const MAX_TODO_NOTE_LENGTH = 1000;
const MAX_FOCUS_MINUTES_TOTAL = 1_000_000;
export const MAX_FOCUS_CREDIT_MINUTES = 600;

export function createTodoId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function normalizeTodoSubtasks(value: unknown): { subtasks?: TodoSubtask[] } {
  if (!Array.isArray(value)) return {};
  const subtasks: TodoSubtask[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const raw = entry as Record<string, unknown>;
    if (typeof raw.title !== "string") continue;
    const title = raw.title.trim();
    if (!title) continue;
    const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : createTodoId();
    subtasks.push({ id, title, completed: Boolean(raw.completed) });
    if (subtasks.length >= MAX_TODO_SUBTASKS) break;
  }
  return subtasks.length > 0 ? { subtasks } : {};
}

export function normalizeTodoNote(value: unknown): { note?: string } {
  if (typeof value !== "string") return {};
  const collapsed = value.replace(/[\r\n]+/g, " ").trim();
  if (!collapsed) return {};
  const note = Array.from(collapsed).slice(0, MAX_TODO_NOTE_LENGTH).join("").trim();
  return note ? { note } : {};
}

export function normalizeTodoFocusMinutes(value: unknown, at?: unknown): { focusMinutes?: number; focusedAt?: number } {
  if (typeof value !== "number" || !Number.isFinite(value)) return {};
  const minutes = Math.min(MAX_FOCUS_MINUTES_TOTAL, Math.floor(value));
  if (minutes <= 0) return {};
  return typeof at === "number" && Number.isFinite(at) && at > 0 ? { focusMinutes: minutes, focusedAt: Math.floor(at) } : { focusMinutes: minutes };
}

export function normalizeTodo(todo: Partial<TodoItem>): TodoItem {
  return {
    id: typeof todo.id === "string" && todo.id ? todo.id : createTodoId(),
    title: todo.title?.trim() ?? "",
    completed: Boolean(todo.completed),
    createdAt: typeof todo.createdAt === "number" ? todo.createdAt : Date.now(),
    ...withProject(todo.project),
    ...readTags(todo),
    ...(typeof todo.startedAt === "number" && Number.isFinite(todo.startedAt) && !todo.completed ? { startedAt: todo.startedAt } : {}),
    ...normalizeTodoSubtasks(todo.subtasks),
    ...normalizeTodoNote(todo.note),
    ...normalizeTodoFocusMinutes(todo.focusMinutes, todo.focusedAt),
  };
}

export function addTodoSubtask(todo: TodoItem, rawTitle: string, id = createTodoId()): TodoItem {
  const title = rawTitle.trim();
  if (!title) return todo;
  const current = todo.subtasks ?? [];
  if (current.length >= MAX_TODO_SUBTASKS) return todo;
  return {
    ...todo,
    subtasks: [...current, { id, title, completed: false }],
  };
}

export function toggleTodoSubtask(
  todo: TodoItem,
  subtaskId: string,
  autoCompleteFromSubtasks = false,
): { todo: TodoItem; autoCompleted: boolean } {
  const current = todo.subtasks ?? [];
  const target = current.find((subtask) => subtask.id === subtaskId);
  if (!target) return { todo, autoCompleted: false };
  const nextCompleted = !target.completed;
  const subtasks = current.map((subtask) => (subtask.id === subtaskId ? { ...subtask, completed: nextCompleted } : subtask));
  const shouldAutoComplete =
    autoCompleteFromSubtasks &&
    !todo.completed &&
    nextCompleted &&
    subtasks.length >= 1 &&
    subtasks.every((subtask) => subtask.completed);
  if (shouldAutoComplete) {
    return {
      todo: withoutStart({ ...todo, subtasks, completed: true }),
      autoCompleted: true,
    };
  }
  return {
    todo: { ...todo, subtasks },
    autoCompleted: false,
  };
}

export function deleteTodoSubtask(todo: TodoItem, subtaskId: string): TodoItem {
  const current = todo.subtasks ?? [];
  const subtasks = current.filter((subtask) => subtask.id !== subtaskId);
  if (subtasks.length === current.length) return todo;
  if (subtasks.length === 0) {
    const rest = { ...todo };
    delete rest.subtasks;
    return rest;
  }
  return { ...todo, subtasks };
}

export function updateTodoNote(todo: TodoItem, rawNote: string): TodoItem {
  const normalized = normalizeTodoNote(rawNote);
  if (!normalized.note) {
    if (todo.note === undefined) return todo;
    const rest = { ...todo };
    delete rest.note;
    return rest;
  }
  if (todo.note === normalized.note) return todo;
  return { ...todo, note: normalized.note };
}

export function focusMinutesToAdd(todo: Pick<TodoItem, "focusedAt">, minutes: number, now: number): number {
  if (!Number.isFinite(minutes)) return 0;
  const asked = Math.min(MAX_FOCUS_CREDIT_MINUTES, Math.floor(minutes));
  if (asked <= 0) return 0;
  const last = todo.focusedAt;
  if (typeof last !== "number" || !Number.isFinite(last) || last > now) return asked;
  return Math.min(asked, Math.round((now - last) / 60_000));
}

export function addTodoFocusMinutes(todo: TodoItem, minutes: number, now = Date.now()): TodoItem {
  const delta = focusMinutesToAdd(todo, minutes, now);
  if (delta <= 0) return todo;
  const total = Math.min(MAX_FOCUS_MINUTES_TOTAL, (todo.focusMinutes ?? 0) + delta);
  return { ...todo, focusMinutes: total, focusedAt: now };
}

export function creditFocus(todos: TodoItem[], todoId: string, minutes: number, kind: FocusCreditKind, now: number): TodoItem[] {
  const index = todos.findIndex((todo) => todo.id === todoId);
  if (index < 0) return todos;
  const todo = todos[index];
  if (kind === "due" && (todo.completed || !isInProgress(todo))) return todos;
  const credited = addTodoFocusMinutes(todo, minutes, now);
  return credited === todo ? todos : todos.map((item, at) => (at === index ? credited : item));
}

export function withoutFocus<T extends Pick<TodoItem, "focusMinutes" | "focusedAt">>(todo: T): T {
  if (todo.focusMinutes === undefined && todo.focusedAt === undefined) return todo;
  const rest = { ...todo };
  delete rest.focusMinutes;
  delete rest.focusedAt;
  return rest;
}

export function withProject(value: unknown): { project?: string } {
  const project = readProject(value);
  return project ? { project } : {};
}

export function parseScheduledTodos(stored: string | null): ScheduledTodo[] {
  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return sortScheduledTodos(
      parsed
        .map((value) => normalizeScheduledTodo((value ?? {}) as Partial<ScheduledTodo>))
        .filter((todo): todo is ScheduledTodo => todo !== null),
    );
  } catch {
    return [];
  }
}

export function parseTodos(stored: string | null): TodoItem[] {
  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored) as Partial<TodoItem>[];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((todo) => typeof todo.title === "string" && todo.title.trim())
      .map(normalizeTodo);
  } catch {
    return [];
  }
}

export function parseCurrentTodoDate(stored: string | null, dayStartHour = 0) {
  return stored ?? getLogicalTodoDate(new Date(), dayStartHour);
}

export function parseTodoArchives(stored: string | null): TodoArchive[] {
  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored) as Partial<TodoArchive>[];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((archive) => typeof archive.date === "string" && archive.date)
      .map((archive) => ({
        date: archive.date ?? getLocalDateString(),
        todos: Array.isArray(archive.todos)
          ? archive.todos
              .filter(
                (todo) => typeof todo.title === "string" && todo.title.trim(),
              )
              .map(normalizeTodo)
          : [],
        dailyNote:
          typeof archive.dailyNote === "string" ? archive.dailyNote : "",
        savedAt: typeof archive.savedAt === "number" ? archive.savedAt : 0,
        savedToDisk: Boolean(archive.savedToDisk),
        filePath:
          typeof archive.filePath === "string" ? archive.filePath : undefined,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

export function normalizeLocalTodoKeys(keys: LocalTodoKeys): TodosData {
  return {
    date: parseCurrentTodoDate(keys["focusd-island-current-date"]),
    todos: parseTodos(keys["focusd-island-todos"]),
    scheduled: parseScheduledTodos(keys["focusd-island-scheduled-todos"]),
    archives: parseTodoArchives(keys["focusd-island-archives"]),
    dailyNote: keys["focusd-island-daily-note"] ?? "",
    activeTodoId: keys["focusd-island-active-todo"] || null,
  };
}
