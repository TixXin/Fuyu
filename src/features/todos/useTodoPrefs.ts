import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import { TODO_PREFS_STORAGE_KEY, loadTodoPrefs, saveTodoPrefs } from "./storage.ts";
import type { TodoPrefs } from "./todoPrefs.ts";

const CHANGED_HERE = "fuyu-todo-prefs-changed";

export function useTodoPrefs() {
  const [prefs, setPrefsState] = useState<TodoPrefs>(loadTodoPrefs);
  const self = useRef({});

  const setPrefs = useCallback((next: SetStateAction<TodoPrefs>) => {
    const current = loadTodoPrefs();
    const resolved = typeof next === "function" ? next(current) : next;
    saveTodoPrefs(resolved);
    setPrefsState((prev) => (JSON.stringify(prev) === JSON.stringify(resolved) ? prev : resolved));
    window.dispatchEvent(new CustomEvent(CHANGED_HERE, { detail: self.current }));
  }, []);

  useEffect(() => {
    const reload = () => {
      const stored = loadTodoPrefs();
      setPrefsState((current) => (JSON.stringify(current) === JSON.stringify(stored) ? current : stored));
    };
    const syncFromOtherWindow = (event: StorageEvent) => {
      if (event.key === TODO_PREFS_STORAGE_KEY || event.key === null) reload();
    };
    const syncFromThisWindow = (event: Event) => {
      if ((event as CustomEvent).detail !== self.current) reload();
    };
    window.addEventListener("storage", syncFromOtherWindow);
    window.addEventListener(CHANGED_HERE, syncFromThisWindow);
    return () => {
      window.removeEventListener("storage", syncFromOtherWindow);
      window.removeEventListener(CHANGED_HERE, syncFromThisWindow);
    };
  }, []);

  return [prefs, setPrefs] as const;
}
