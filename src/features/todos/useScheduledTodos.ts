import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "../../i18n";
import { getLocalDateString } from "../../utils/date";
import { pushIslandReminder } from "../timer";
import { DUE_REMINDER_SOURCE, dueReminderId, pickDueReminders } from "./dueReminders";
import { sortScheduledTodos, splitDueTodos, toTodoItems } from "./schedule";
import { createTodoId, loadScheduledTodos, saveScheduledTodos } from "./storage";
import { withTags, type TodoTags } from "./tags";
import type { ScheduledTodo, TodoItem } from "./types";
import { useTodoFileField } from "./useTodoFileField";

const remindedDue = new Set<string>();

export function useScheduledTodos(
  currentTodoDate: string,
  setTodos: Dispatch<SetStateAction<TodoItem[]>>,
) {
  const dueTitle = useTranslation().todoIsland.tags.dueTitle;
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
    for (const todo of pickDueReminders(due, remindedDue)) {
      pushIslandReminder({ id: dueReminderId(todo), source: DUE_REMINDER_SOURCE, icon: "flag", title: dueTitle, detail: todo.title });
    }
  }, [currentTodoDate, dueTitle, scheduledTodos, setTodos]);

  const scheduleTodo = useCallback((title: string, date: string, project?: string): ScheduledTodo => {
    const todo = { id: createTodoId(), title, date, createdAt: Date.now(), ...(project ? { project } : {}) };
    setScheduledTodos((current) => sortScheduledTodos([...current, todo]));
    return todo;
  }, []);

  const deleteScheduledTodo = useCallback((id: string) => {
    setScheduledTodos((current) => current.filter((todo) => todo.id !== id));
  }, []);

  const tagScheduledTodo = useCallback((id: string, tags: TodoTags) => {
    setScheduledTodos((current) => current.map((todo) => (todo.id === id ? withTags(todo, tags) : todo)));
  }, []);

  return { scheduledTodos, setScheduledTodos, scheduleTodo, deleteScheduledTodo, tagScheduledTodo };
}
