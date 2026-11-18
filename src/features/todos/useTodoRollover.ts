import { useCallback, useEffect, useRef } from "react";
import { visibilityInterval } from "../../lib/useVisibilityInterval";
import { getTodoSignature, type TodoMarkdownOptions } from "./markdown.ts";
import { isDateString } from "./schedule.ts";
import { clearLastSavedSignature, createTodoId, loadLastSavedSignature, saveLastSavedSignature } from "./storage.ts";
import { getLogicalTodoDate } from "./todoPrefs.ts";
import type { TodoItem } from "./types.ts";

type TodoRolloverOptions = {
  currentTodoDate: string;
  dayStartHour?: number;
  markdownOptions?: TodoMarkdownOptions;
  todos: TodoItem[];
  dailyNote: string;
  carryOverIncompleteTodos: boolean;
  saveDirectory: string;
  saveTodosToDisk: (date: string, todoList: TodoItem[], nextDailyNote: string) => Promise<unknown>;
  upsertArchive: (date: string, todoList: TodoItem[], nextDailyNote: string, savedToDisk: boolean) => void;
  onStartDay: (nextDate: string, carriedTodos: TodoItem[]) => void;
};

export function useTodoRollover({
  currentTodoDate,
  dayStartHour = 0,
  markdownOptions,
  todos,
  dailyNote,
  carryOverIncompleteTodos,
  saveDirectory,
  saveTodosToDisk,
  upsertArchive,
  onStartDay,
}: TodoRolloverOptions) {
  const checkedDayStart = useRef<number | null>(null);

  const rolloverToToday = useCallback(
    async (nextDate: string) => {
      const signature = getTodoSignature(currentTodoDate, todos, dailyNote, markdownOptions);
      const lastSavedSignature = loadLastSavedSignature();
      const carryOverCreatedAt = Date.now();
      const carriedTodos = carryOverIncompleteTodos
        ? todos
            .filter((todo) => !todo.completed)
            .map((todo, index) => ({
              ...todo,
              id: createTodoId(),
              completed: false,
              createdAt: carryOverCreatedAt + index,
            }))
        : [];

      if ((todos.length > 0 || dailyNote.trim()) && signature !== lastSavedSignature) {
        if (saveDirectory.trim()) {
          try {
            await saveTodosToDisk(currentTodoDate, todos, dailyNote);
          } catch (error) {
            console.error("Failed to auto-save todo markdown", error);
            upsertArchive(currentTodoDate, todos, dailyNote, false);
          }
        } else {
          upsertArchive(currentTodoDate, todos, dailyNote, false);
        }
      }

      onStartDay(nextDate, carriedTodos);

      if (carriedTodos.length > 0) {
        clearLastSavedSignature();
      } else {
        saveLastSavedSignature(getTodoSignature(nextDate, [], "", markdownOptions));
      }
    },
    [carryOverIncompleteTodos, currentTodoDate, dailyNote, markdownOptions, onStartDay, saveDirectory, saveTodosToDisk, todos, upsertArchive],
  );

  useEffect(() => {
    if (checkedDayStart.current === dayStartHour) return;
    checkedDayStart.current = dayStartHour;
    const today = getLogicalTodoDate(new Date(), dayStartHour);
    if (!isDateString(currentTodoDate) || currentTodoDate < today) {
      void rolloverToToday(today);
    }
  }, [currentTodoDate, dayStartHour, rolloverToToday]);

  useEffect(() => {
    const checkForNewDay = () => {
      const today = getLogicalTodoDate(new Date(), dayStartHour);
      if (!isDateString(currentTodoDate) || currentTodoDate < today) {
        void rolloverToToday(today);
      }
    };
    return visibilityInterval(checkForNewDay, 30_000);
  }, [currentTodoDate, dayStartHour, rolloverToToday]);
}
