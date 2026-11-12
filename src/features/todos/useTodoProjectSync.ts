import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { saveTodoMarkdown } from "./api";
import { formatTodoDocumentAsMarkdown } from "./markdown";
import { mapProjects, MAX_TODO_PROJECTS, projectChanges, projectsOf } from "./project";
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
  const seen = useRef(projects);

  useEffect(() => {
    const before = seen.current;
    seen.current = projects;
    const { renamed, removed } = projectChanges(before, projects);
    if (renamed.size > 0 || removed.size > 0) {
      const current = (name: string) => renamed.get(name) ?? (removed.has(name) ? undefined : name);
      setTodos((items) => mapProjects(items, current));
      setScheduledTodos((items) => mapProjects(items, current));
      if (renamed.size > 0) renameInArchives(renamed, currentDate, archives, setArchives);
      return;
    }
    const known = new Set(projects.map((project) => project.name));
    const missing = projectsOf([...todos, ...scheduledTodos]).filter((name) => !known.has(name));
    if (missing.length > 0 && projects.length < MAX_TODO_PROJECTS) {
      onProjectsChange([...projects, ...missing.map((name) => ({ id: createTodoId(), name }))].slice(0, MAX_TODO_PROJECTS));
    }
  }, [archives, currentDate, onProjectsChange, projects, scheduledTodos, setArchives, setScheduledTodos, setTodos, todos]);
}

function renameInArchives(renamed: ReadonlyMap<string, string>, currentDate: string, archives: TodoArchive[], setArchives: Dispatch<SetStateAction<TodoArchive[]>>) {
  const changed = archives.flatMap((archive) => {
    const todos = mapProjects(archive.todos, (name) => renamed.get(name) ?? name);
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
