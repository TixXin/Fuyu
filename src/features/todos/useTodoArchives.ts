import { useCallback, useEffect, useState } from "react";
import { loadTodoArchives, saveTodoArchives } from "./storage.ts";
import { filterArchivesByRetention, type TodoArchiveRetentionDays } from "./todoPrefs.ts";
import type { TodoArchive, TodoItem } from "./types.ts";

export function useTodoArchives(retentionDays: TodoArchiveRetentionDays = 0) {
  const [archives, setArchives] = useState<TodoArchive[]>(loadTodoArchives);

  const upsertArchive = useCallback(
    (
      date: string,
      todoList: TodoItem[],
      nextDailyNote: string,
      savedToDisk: boolean,
      filePath?: string,
    ) => {
      const archive: TodoArchive = {
        date,
        todos: todoList,
        dailyNote: nextDailyNote,
        savedAt: Date.now(),
        savedToDisk,
        filePath,
      };

      setArchives((currentArchives) => {
        const sorted = [archive, ...currentArchives.filter((item) => item.date !== date)].sort(
          (a, b) => b.date.localeCompare(a.date),
        );
        return filterArchivesByRetention(sorted, date, retentionDays);
      });
    },
    [retentionDays],
  );

  useEffect(() => {
    saveTodoArchives(archives);
  }, [archives]);

  return { archives, setArchives, upsertArchive };
}
