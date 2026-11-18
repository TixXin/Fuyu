import { useMemo } from "react";
import type { IslandSettings } from "../../lib/settings/types";
import { todoElapsedLabel } from "./todoPrefs.ts";
import type { TodoItem } from "./types.ts";
import { useElapsedNow } from "./useElapsedNow";
import { useTodoPrefs } from "./useTodoPrefs";
import { useTodoRotation } from "./useTodoRotation";

export function useCollapsedTodo(
  todos: TodoItem[],
  activeTodoId: string | null,
  settings: Pick<IslandSettings, "rotateTodos" | "todoRotationSeconds" | "showIdleTodoCount">,
  isRotationPaused: boolean,
) {
  const [prefs] = useTodoPrefs();
  const pendingTodoIds = useMemo(
    () => todos.filter((todo) => !todo.completed).map((todo) => todo.id),
    [todos],
  );
  const displayedTodoId = useTodoRotation(
    pendingTodoIds,
    activeTodoId,
    settings.rotateTodos,
    settings.todoRotationSeconds,
    isRotationPaused,
  );
  const displayedTodo = useMemo(
    () => todos.find((todo) => todo.id === displayedTodoId && !todo.completed) ?? null,
    [displayedTodoId, todos],
  );
  const now = useElapsedNow(prefs.showElapsed && typeof displayedTodo?.startedAt === "number");
  const collapsedTaskTitle = useMemo(() => {
    if (!displayedTodo) return null;
    const elapsed = todoElapsedLabel(displayedTodo.startedAt, now, prefs.showElapsed);
    return elapsed ? `${displayedTodo.title} · ${elapsed}` : displayedTodo.title;
  }, [displayedTodo, now, prefs.showElapsed]);
  const pendingTodoCount = pendingTodoIds.length;
  const collapsedTodoCount = settings.showIdleTodoCount && !collapsedTaskTitle && pendingTodoCount > 0
    ? pendingTodoCount
    : null;
  return { collapsedTaskTitle, collapsedTodoCount };
}
