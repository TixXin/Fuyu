import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveTodoMarkdown } from "./api";
import { formatTodoDocumentAsMarkdown, getTodoSignature } from "./markdown.ts";
import { saveLastSavedSignature } from "./storage.ts";
import type { SaveState, TodoItem } from "./types.ts";
import { useTodoAutoSave } from "./useTodoAutoSave";
import { useTodoSaveDirectory } from "./useTodoSaveDirectory";

type UpsertArchive = (
  date: string,
  todoList: TodoItem[],
  nextDailyNote: string,
  savedToDisk: boolean,
  filePath?: string,
) => void;

type TodoSavingOptions = {
  currentTodoDate: string;
  todos: TodoItem[];
  dailyNote: string;
  markdownPriority: boolean;
  markdownElapsed: boolean;
  upsertArchive: UpsertArchive;
  onMissingSaveDirectory: () => void;
};

export function useTodoSaving({
  currentTodoDate,
  todos,
  dailyNote,
  markdownPriority,
  markdownElapsed,
  upsertArchive,
  onMissingSaveDirectory,
}: TodoSavingOptions) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const saveStateResetTimer = useRef<number | null>(null);
  const clearNeedsPath = useCallback(() => {
    setSaveState((current) => (current === "needs-path" ? "idle" : current));
  }, []);
  const saveDirectory = useTodoSaveDirectory(clearNeedsPath);
  const markdownOptions = useMemo(
    () => ({ markdownPriority, markdownElapsed }),
    [markdownElapsed, markdownPriority],
  );

  const saveTodosToDisk = useCallback(
    async (date: string, todoList: TodoItem[], nextDailyNote: string) => {
      const directory = saveDirectory.trim();
      if (!directory) throw new Error("Missing todo save path.");

      const result = await saveTodoMarkdown(
        directory,
        date,
        formatTodoDocumentAsMarkdown(todoList, nextDailyNote, markdownOptions),
      );

      upsertArchive(date, todoList, nextDailyNote, true, result.filePath);
      saveLastSavedSignature(getTodoSignature(date, todoList, nextDailyNote, markdownOptions));
      return result;
    },
    [markdownOptions, saveDirectory, upsertArchive],
  );

  const showTodoSavedState = useCallback(() => {
    if (saveStateResetTimer.current !== null) {
      window.clearTimeout(saveStateResetTimer.current);
    }
    setSaveState("saved");
    saveStateResetTimer.current = window.setTimeout(() => {
      setSaveState("idle");
      saveStateResetTimer.current = null;
    }, 1200);
  }, []);

  const saveTodayTodos = useCallback(async () => {
    if (!saveDirectory.trim()) {
      setSaveState("needs-path");
      onMissingSaveDirectory();
      return;
    }
    setSaveState("saving");
    try {
      await saveTodosToDisk(currentTodoDate, todos, dailyNote);
      showTodoSavedState();
    } catch (error) {
      console.error("Failed to save todo markdown", error);
      setSaveState("error");
    }
  }, [currentTodoDate, dailyNote, onMissingSaveDirectory, saveDirectory, saveTodosToDisk, showTodoSavedState, todos]);

  useTodoAutoSave({
    currentTodoDate,
    todos,
    dailyNote,
    saveDirectory,
    markdownOptions,
    saveTodosToDisk,
    setSaveState,
  });

  useEffect(
    () => () => {
      if (saveStateResetTimer.current !== null) {
        window.clearTimeout(saveStateResetTimer.current);
      }
    },
    [],
  );

  return { saveDirectory, saveState, markdownOptions, saveTodosToDisk, saveTodayTodos };
}
