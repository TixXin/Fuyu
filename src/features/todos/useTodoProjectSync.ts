import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { saveTodoMarkdown } from "./api";
import { formatTodoDocumentAsMarkdown } from "./markdown";
import { mapProjects, MAX_TODO_PROJECTS, projectsOf } from "./project";
import { applyProjectEdit, readTodoProjectEdit, TODO_PROJECT_EDIT_STORAGE_KEY, type TodoProjectEdit } from "./projectEdits";
import { createTodoId } from "./storage";
import type { ScheduledTodo, TodoArchive, TodoItem, TodoProject } from "./types";

type TodoProjectSyncOptions = {
  projects: readonly TodoProject[];
  onProjectsChange: (projects: TodoProject[]) => void;
  currentDate: string;
  todos: TodoItem[];
  setTodos: Dispatch<SetStateAction<TodoItem[]>>;
  scheduledTodos: ScheduledTodo[];
  setScheduledTodos: Dispatch<SetStateAction<ScheduledTodo[]>>;
  archives: TodoArchive[];
  setArchives: Dispatch<SetStateAction<TodoArchive[]>>;
};

export function useTodoProjectSync({
  projects, onProjectsChange, currentDate, todos, setTodos, scheduledTodos, setScheduledTodos, archives, setArchives,
}: TodoProjectSyncOptions) {
  const latest = useRef({ projects, currentDate, archives });
  useEffect(() => {
    latest.current = { projects, currentDate, archives };
  }, [archives, currentDate, projects]);

  const editProjects = useCallback((edit: TodoProjectEdit) => {
    const applied = applyProjectEdit(latest.current.projects, edit, createTodoId);
    if (!applied) return null;
    latest.current = { ...latest.current, projects: applied.projects };
    onProjectsChange(applied.projects);
    const { renamed, removed } = applied;
    if (renamed) {
      const rename = (name: string) => (name === renamed.from ? renamed.to : name);
      setTodos((items) => mapProjects(items, rename));
      setScheduledTodos((items) => mapProjects(items, rename));
      renameInArchives(rename, latest.current.currentDate, latest.current.archives, setArchives);
    }
    if (removed) {
      const remove = (name: string) => (name === removed ? undefined : name);
      setTodos((items) => mapProjects(items, remove));
      setScheduledTodos((items) => mapProjects(items, remove));
    }
    return applied;
  }, [onProjectsChange, setArchives, setScheduledTodos, setTodos]);

  useEffect(() => {
    const handleRequest = (event: StorageEvent) => {
      if (event.key !== TODO_PROJECT_EDIT_STORAGE_KEY) return;
      const edit = readTodoProjectEdit(event.newValue);
      if (edit) editProjects(edit);
    };
    window.addEventListener("storage", handleRequest);
    return () => window.removeEventListener("storage", handleRequest);
  }, [editProjects]);

  useEffect(() => {
    const known = new Set(projects.map((project) => project.name));
    const missing = projectsOf([...todos, ...scheduledTodos]).filter((name) => !known.has(name));
    if (missing.length > 0 && projects.length < MAX_TODO_PROJECTS) {
      onProjectsChange([...projects, ...missing.map((name) => ({ id: createTodoId(), name }))].slice(0, MAX_TODO_PROJECTS));
    }
  }, [onProjectsChange, projects, scheduledTodos, todos]);

  return editProjects;
}

function renameInArchives(rename: (name: string) => string, currentDate: string, archives: TodoArchive[], setArchives: Dispatch<SetStateAction<TodoArchive[]>>) {
  const changed = archives.flatMap((archive) => {
    const todos = mapProjects(archive.todos, rename);
    return todos === archive.todos ? [] : [{ ...archive, todos }];
  });
  if (changed.length === 0) return;
  setArchives((items) => items.map((item) => changed.find((archive) => archive.date === item.date) ?? item));
  for (const archive of changed) {
    if (!archive.savedToDisk || !archive.filePath || archive.date === currentDate) continue;
    const directory = archive.filePath.slice(0, Math.max(archive.filePath.lastIndexOf("/"), archive.filePath.lastIndexOf("\\")));
    saveTodoMarkdown(directory, archive.date, formatTodoDocumentAsMarkdown(archive.todos, archive.dailyNote))
      .catch((error) => console.error(`Failed to rewrite the saved todos of ${archive.date}`, error));
  }
}
