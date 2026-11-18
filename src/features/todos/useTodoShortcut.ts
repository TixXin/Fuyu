import { useCallback, useEffect, useMemo, useState } from "react";
import { setBuiltinConfig } from "../plugin-kernel/builtinSwitches";
import { useBuiltinConfig } from "../plugin-kernel/useBuiltinPlugins";
import { getTodoShortcutProblem, listenTodoShortcutProblem, type TodoShortcutProblem } from "./api";
import { OWNER } from "./plugin/owner.ts";
import {
  readTodoQuickAddShortcut,
  SUGGESTED_TODO_SHORTCUT,
  TODO_QUICK_ADD_SHORTCUT_KEY,
  todoShortcutConfigValue,
} from "./plugin/quickAdd.ts";

export { readTodoQuickAddShortcut, SUGGESTED_TODO_SHORTCUT, TODO_QUICK_ADD_SHORTCUT_KEY, todoShortcutConfigValue };

function saveTodoShortcut(next: string) {
  void setBuiltinConfig(OWNER, TODO_QUICK_ADD_SHORTCUT_KEY, todoShortcutConfigValue(next)).catch((error: unknown) => {
    console.error("Could not save the todo quick-add shortcut", error);
  });
}

export function useTodoQuickAddShortcut(): [string, (next: string) => void] {
  const raw = useBuiltinConfig(OWNER);
  const shortcut = useMemo(() => readTodoQuickAddShortcut(raw), [raw]);
  const update = useCallback((next: string) => saveTodoShortcut(next), []);
  return [shortcut, update];
}

export function useTodoShortcutProblem() {
  const [problem, setProblem] = useState<TodoShortcutProblem | null>(null);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | null = null;
    getTodoShortcutProblem()
      .then((current) => {
        if (!cancelled) setProblem(current);
      })
      .catch((error: unknown) => console.error("Failed to read the todo quick-add shortcut", error));
    void listenTodoShortcutProblem(setProblem)
      .then((unlisten) => {
        if (cancelled) unlisten();
        else stop = unlisten;
      })
      .catch((error: unknown) => console.error("Failed to listen for the todo quick-add shortcut", error));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  return problem;
}
