import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { remindersV1 } from "@fuyu/plugin-services";
import { useTranslation } from "../../i18n";
import { windowServices } from "../plugin-kernel/services";
import { DUE_REMINDER_SOURCE, dueReminderId, pickDueReminders } from "./dueReminders.ts";
import { sortScheduledTodos, splitDueTodos, toTodoItems } from "./schedule.ts";
import { createTodoId, loadScheduledTodos, saveScheduledTodos } from "./storage.ts";
import { readTags, withTags, type TodoTags } from "./tags.ts";
import { getLogicalTodoDate } from "./todoPrefs.ts";
import type { ScheduledTodo, TodoItem } from "./types.ts";
import { useTodoFileField } from "./useTodoFileField";

const remindedDue = new Set<string>();

export function useScheduledTodos(
  currentTodoDate: string,
  setTodos: Dispatch<SetStateAction<TodoItem[]>>,
  dayStartHour = 0,
) {
  const dueTitle = useTranslation().todoIsland.tags.dueTitle;
  const [scheduledTodos, setScheduledTodos] = useState<ScheduledTodo[]>(loadScheduledTodos);
  useTodoFileField("scheduled", setScheduledTodos);

  useEffect(() => {
    saveScheduledTodos(scheduledTodos);
  }, [scheduledTodos]);

  useEffect(() => {
    if (currentTodoDate !== getLogicalTodoDate(new Date(), dayStartHour)) {
      return;
    }

    const { due, later } = splitDueTodos(scheduledTodos, currentTodoDate);
    if (due.length === 0) return;

    setScheduledTodos(later);
    setTodos((currentTodos) => [
      ...toTodoItems(due).filter((todo) => !currentTodos.some((item) => item.id === todo.id)),
      ...currentTodos,
    ]);
    for (const todo of pickDueReminders(due, remindedDue)) {
      void windowServices.get(remindersV1).push({ id: dueReminderId(todo), source: DUE_REMINDER_SOURCE, icon: "flag", title: dueTitle, detail: todo.title }).catch(() => undefined);
    }
  }, [currentTodoDate, dayStartHour, dueTitle, scheduledTodos, setTodos]);

  const scheduleTodo = useCallback((title: string, date: string, project?: string, tags?: TodoTags): ScheduledTodo => {
    const todo: ScheduledTodo = {
      id: createTodoId(),
      title,
      date,
      createdAt: Date.now(),
      ...(project ? { project } : {}),
      ...(tags ? readTags(tags) : {}),
    };
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
