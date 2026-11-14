import { useCallback, useEffect, useMemo, useState, type SetStateAction } from "react";
import { createTodoId, loadActiveTodoId, loadTodos, saveActiveTodoId, saveTodos } from "./storage";
import { adoptActiveTodo, isInProgress, latestStartedId, toggleStarted, withoutStart } from "./activeTodos";
import { splitProjectPrefix } from "./project";
import type { TodoItem } from "./types";
import { useTodoFileField } from "./useTodoFileField";

export function useTodoList(onStartTodo: () => void) {
  const [todos, setTodos] = useState<TodoItem[]>(() => adoptActiveTodo(loadTodos(), loadActiveTodoId(), Date.now()));
  const [draftTodo, setDraftTodo] = useState("");
  const activeTodoId = useMemo(() => latestStartedId(todos), [todos]);
  const adoptOutsideActive = useCallback((value: SetStateAction<string | null>) => {
    if (typeof value === "function") return;
    setTodos((currentTodos) => adoptActiveTodo(currentTodos, value, Date.now()));
  }, []);
  useTodoFileField("todos", setTodos);
  useTodoFileField("activeTodoId", adoptOutsideActive);

  const addTodo = useCallback((defaultProject?: string) => {
    const { title, project = typeof defaultProject === "string" ? defaultProject : undefined } = splitProjectPrefix(draftTodo);

    if (!title) {
      return;
    }

    setTodos((currentTodos) => [
      {
        id: createTodoId(),
        title,
        completed: false,
        createdAt: Date.now(),
        ...(project ? { project } : {}),
      },
      ...currentTodos,
    ]);
    setDraftTodo("");
  }, [draftTodo]);

  const toggleTodo = useCallback((id: string) => {
    setTodos((currentTodos) =>
      currentTodos.map((todo) =>
        todo.id === id ? withoutStart({ ...todo, completed: !todo.completed }) : todo,
      ),
    );
  }, []);

  const updateTodoTitle = useCallback((id: string, title: string) => {
    const nextTitle = title.trim();

    if (!nextTitle) {
      return;
    }

    setTodos((currentTodos) =>
      currentTodos.map((todo) =>
        todo.id === id ? { ...todo, title: nextTitle } : todo,
      ),
    );
  }, []);

  const startTodo = useCallback(
    (id: string) => {
      const todo = todos.find((item) => item.id === id);

      if (!todo || todo.completed) {
        return;
      }

      setTodos((currentTodos) => toggleStarted(currentTodos, id, Date.now()));
      if (!isInProgress(todo)) onStartTodo();
    },
    [onStartTodo, todos],
  );

  const stopAllTodos = useCallback(() => {
    setTodos((currentTodos) => (currentTodos.some(isInProgress) ? currentTodos.map(withoutStart) : currentTodos));
  }, []);

  const deleteTodo = useCallback((id: string) => {
    setTodos((currentTodos) => currentTodos.filter((todo) => todo.id !== id));
  }, []);

  const reorderTodo = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) {
      return;
    }

    setTodos((currentTodos) => {
      const sourceIndex = currentTodos.findIndex((todo) => todo.id === sourceId);
      const targetIndex = currentTodos.findIndex((todo) => todo.id === targetId);

      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
        return currentTodos;
      }

      const nextTodos = [...currentTodos];
      const [movedTodo] = nextTodos.splice(sourceIndex, 1);
      const insertIndex = targetIndex;
      nextTodos.splice(insertIndex, 0, movedTodo);

      return nextTodos;
    });
  }, []);

  useEffect(() => {
    saveTodos(todos);
  }, [todos]);

  useEffect(() => {
    saveActiveTodoId(activeTodoId);
  }, [activeTodoId]);

  return {
    todos,
    setTodos,
    draftTodo,
    setDraftTodo,
    activeTodoId,
    stopAllTodos,
    addTodo,
    toggleTodo,
    updateTodoTitle,
    startTodo,
    deleteTodo,
    reorderTodo,
  };
}
