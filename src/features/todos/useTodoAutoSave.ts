import { useEffect, useRef } from "react";
import { getTodoSignature, type TodoMarkdownOptions } from "./markdown.ts";
import { hasNoteContent } from "./newTodoDefaults.ts";
import { loadLastSavedSignature } from "./storage.ts";
import type { SaveState, TodoItem } from "./types.ts";

type TodoAutoSaveOptions = {
  currentTodoDate: string;
  todos: TodoItem[];
  dailyNote: string;
  saveDirectory: string;
  markdownOptions?: TodoMarkdownOptions;
  noteTemplate?: string;
  saveTodosToDisk: (date: string, todoList: TodoItem[], nextDailyNote: string) => Promise<unknown>;
  setSaveState: (state: SaveState) => void;
};

export function useTodoAutoSave({
  currentTodoDate,
  todos,
  dailyNote,
  saveDirectory,
  markdownOptions,
  noteTemplate = "",
  saveTodosToDisk,
  setSaveState,
}: TodoAutoSaveOptions) {
  const autoSaveTimer = useRef<number | null>(null);
  const autoSaveRequestId = useRef(0);
  const didHydrateAutoSave = useRef(false);

  useEffect(() => {
    if (!didHydrateAutoSave.current) {
      didHydrateAutoSave.current = true;
      return;
    }

    if (autoSaveTimer.current !== null) {
      window.clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }

    if (!saveDirectory.trim()) return;

    const signature = getTodoSignature(currentTodoDate, todos, dailyNote, markdownOptions);
    const lastSavedSignature = loadLastSavedSignature();

    if (!todos.length && !hasNoteContent(dailyNote, noteTemplate) && !lastSavedSignature) return;
    if (signature === lastSavedSignature) return;

    const timer = window.setTimeout(() => {
      autoSaveTimer.current = null;
      autoSaveRequestId.current += 1;
      const requestId = autoSaveRequestId.current;

      void saveTodosToDisk(currentTodoDate, todos, dailyNote)
        .catch((error) => {
          if (requestId === autoSaveRequestId.current) {
            console.error("Failed to auto-save todo markdown", error);
            setSaveState("error");
          }
        });
    }, 700);

    autoSaveTimer.current = timer;

    return () => {
      if (autoSaveTimer.current === timer) {
        window.clearTimeout(timer);
        autoSaveTimer.current = null;
      }
    };
  }, [currentTodoDate, dailyNote, markdownOptions, noteTemplate, saveDirectory, saveTodosToDisk, setSaveState, todos]);

  useEffect(
    () => () => {
      if (autoSaveTimer.current !== null) {
        window.clearTimeout(autoSaveTimer.current);
      }
    },
    [],
  );
}
