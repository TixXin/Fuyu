import { MAX_TODO_PROJECTS, readProject } from "./project.ts";
import type { TodoProject } from "./types";

export const TODO_PROJECT_EDIT_STORAGE_KEY = "fuyu-todo-project-edit";

const EDIT_MAX_AGE_MS = 5_000;

export type TodoProjectEdit =
  | { type: "add"; name: string }
  | { type: "rename"; id: string; name: string }
  | { type: "move"; id: string; by: -1 | 1 }
  | { type: "remove"; id: string };

export type AppliedProjectEdit = {
  projects: TodoProject[];
  renamed?: { from: string; to: string };
  removed?: string;
};

export function applyProjectEdit(projects: readonly TodoProject[], edit: TodoProjectEdit, newId: () => string): AppliedProjectEdit | null {
  if (edit.type === "add") {
    const name = readProject(edit.name);
    if (!name || projects.length >= MAX_TODO_PROJECTS || projects.some((project) => project.name === name)) return null;
    return { projects: [...projects, { id: newId(), name }] };
  }
  const index = projects.findIndex((project) => project.id === edit.id);
  if (index < 0) return null;
  const project = projects[index];
  if (edit.type === "remove") {
    return { projects: projects.filter((item) => item.id !== edit.id), removed: project.name };
  }
  if (edit.type === "move") {
    const to = index + edit.by;
    if (to < 0 || to >= projects.length) return null;
    const next = [...projects];
    [next[index], next[to]] = [next[to], next[index]];
    return { projects: next };
  }
  const name = readProject(edit.name);
  if (!name || name === project.name || projects.some((item) => item.name === name)) return null;
  return {
    projects: projects.map((item) => (item.id === edit.id ? { ...item, name } : item)),
    renamed: { from: project.name, to: name },
  };
}

export function requestTodoProjectEdit(edit: TodoProjectEdit) {
  try {
    localStorage.setItem(TODO_PROJECT_EDIT_STORAGE_KEY, JSON.stringify({ edit, requestedAt: Date.now(), nonce: Math.random() }));
  } catch (error) {
    console.error("Failed to send the project edit to the island", error);
  }
}

export function readTodoProjectEdit(value: string | null, now = Date.now()): TodoProjectEdit | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { edit?: TodoProjectEdit; requestedAt?: unknown };
    if (typeof parsed.requestedAt !== "number" || now - parsed.requestedAt > EDIT_MAX_AGE_MS) return null;
    const edit = parsed.edit;
    if (!edit || typeof edit !== "object") return null;
    if (edit.type === "add" && typeof edit.name === "string") return edit;
    if (edit.type === "rename" && typeof edit.id === "string" && typeof edit.name === "string") return edit;
    if (edit.type === "move" && typeof edit.id === "string" && (edit.by === -1 || edit.by === 1)) return edit;
    if (edit.type === "remove" && typeof edit.id === "string") return edit;
    return null;
  } catch {
    return null;
  }
}
