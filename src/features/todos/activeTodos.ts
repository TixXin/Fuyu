import type { TodoItem } from "./types";

export function isInProgress(todo: TodoItem) {
  return !todo.completed && typeof todo.startedAt === "number";
}

export function latestStartedId(todos: readonly TodoItem[]) {
  let latest: TodoItem | null = null;
  for (const todo of todos) {
    if (isInProgress(todo) && (latest === null || (todo.startedAt ?? 0) > (latest.startedAt ?? 0))) latest = todo;
  }
  return latest?.id ?? null;
}

export function withoutStart(todo: TodoItem): TodoItem {
  if (todo.startedAt === undefined) return todo;
  const next = { ...todo };
  delete next.startedAt;
  return next;
}

export function toggleStarted(todos: TodoItem[], id: string, now: number) {
  return todos.map((todo) => {
    if (todo.id !== id || todo.completed) return todo;
    return isInProgress(todo) ? withoutStart(todo) : { ...todo, startedAt: now };
  });
}

export function adoptActiveTodo(todos: TodoItem[], activeTodoId: string | null, now: number) {
  if (!activeTodoId) return todos;
  const target = todos.find((todo) => todo.id === activeTodoId);
  if (!target || target.completed || isInProgress(target)) return todos;
  const latest = todos.reduce((max, todo) => (isInProgress(todo) ? Math.max(max, todo.startedAt ?? 0) : max), 0);
  return todos.map((todo) => (todo.id === activeTodoId ? { ...todo, startedAt: Math.max(now, latest + 1) } : todo));
}
