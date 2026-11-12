import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { getLocalDateString } from "../../utils/date";
import { sortScheduledTodos, splitDueTodos, toTodoItems } from "./schedule";
import { createTodoId, loadScheduledTodos, saveScheduledTodos } from "./storage";
import type { ScheduledTodo, TodoItem } from "./types";
import { useTodoFileField } from "./useTodoFileField";

export function useScheduledTodos(
  currentTodoDate: string,
  setTodos: Dispatch<SetStateAction<TodoItem[]>>,
) {
  const [scheduledTodos, setScheduledTodos] = useState<ScheduledTodo[]>(loadScheduledTodos);
  useTodoFileField("scheduled", setScheduledTodos);

  useEffect(() => {
    saveScheduledTodos(scheduledTodos);
  }, [scheduledTodos]);

  useEffect(() => {
    if (currentTodoDate !== getLocalDateString()) {
      return;
    }

    const { due, later } = splitDueTodos(scheduledTodos, currentTodoDate);

    if (due.length === 0) {
      return;
    }

    setScheduledTodos(later);
    setTodos((currentTodos) => [
      ...toTodoItems(due).filter((todo) => !currentTodos.some((item) => item.id === todo.id)),
      ...currentTodos,
    ]);
  }, [currentTodoDate, scheduledTodos, setTodos]);

  const scheduleTodo = useCallback((title: string, date: string, project?: string): ScheduledTodo => {
    const todo = { id: createTodoId(), title, date, createdAt: Date.now(), ...(project ? { project } : {}) };
    setScheduledTodos((current) => sortScheduledTodos([...current, todo]));
    return todo;
  }, []);

  const deleteScheduledTodo = useCallback((id: string) => {
    setScheduledTodos((current) => current.filter((todo) => todo.id !== id));
  }, []);

  return { scheduledTodos, setScheduledTodos, scheduleTodo, deleteScheduledTodo };
}
