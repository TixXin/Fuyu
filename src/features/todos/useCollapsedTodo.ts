import { useMemo } from "react";
import type { IslandSettings } from "../../lib/settings/types";
import type { TodoItem } from "./types";
import { useTodoRotation } from "./useTodoRotation";

export function useCollapsedTodo(
  todos: TodoItem[],
  activeTodoId: string | null,
  settings: Pick<IslandSettings, "rotateTodos" | "todoRotationSeconds" | "showIdleTodoCount">,
  isRotationPaused: boolean,
) {
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
  const collapsedTaskTitle = useMemo(() => {
    const activeTodo = todos.find(
      (todo) => todo.id === displayedTodoId && !todo.completed,
    );
    return activeTodo?.title ?? null;
  }, [displayedTodoId, todos]);
  const pendingTodoCount = pendingTodoIds.length;
  const collapsedTodoCount = settings.showIdleTodoCount && !collapsedTaskTitle && pendingTodoCount > 0
    ? pendingTodoCount
    : null;
  return { collapsedTaskTitle, collapsedTodoCount };
}
