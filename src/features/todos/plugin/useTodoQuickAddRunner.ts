import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listenTodoQuickAddShortcut } from "../api";
import type { ScheduledTodo, TodoItem, TodoPageMode } from "../types";
import { cancelQuickAdd, IDLE_QUICK_ADD, syncQuickAddIsland, triggerQuickAdd, type QuickAddSession } from "./quickAdd";

function focusTodoComposer(): boolean {
  const input = document.querySelector<HTMLInputElement>(".todo-island__composer input");
  if (!input) return false;
  input.focus();
  const end = input.value.length;
  input.setSelectionRange(end, end);
  return document.activeElement === input;
}

function blurActiveElement() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

export function useTodoQuickAddRunner({
  enabled,
  mode,
  page,
  pageMode,
  todos,
  scheduledTodos,
  onShowToday,
  openEnabledPage,
  collapseIsland,
}: {
  enabled: boolean;
  mode: string;
  page: string;
  pageMode: TodoPageMode;
  todos: readonly TodoItem[];
  scheduledTodos: readonly ScheduledTodo[];
  onShowToday: () => void;
  openEnabledPage: (page: "todo") => void;
  collapseIsland: () => void;
}) {
  const [session, setSession] = useState<QuickAddSession>(IDLE_QUICK_ADD);
  const itemIds = useMemo(
    () => [...todos.map((todo) => `t:${todo.id}`), ...scheduledTodos.map((todo) => `s:${todo.id}`)],
    [scheduledTodos, todos],
  );
  const latest = useRef({ enabled, pageMode, itemIds, onShowToday, openEnabledPage });
  latest.current = { enabled, pageMode, itemIds, onShowToday, openEnabledPage };

  const collapseFromQuickAdd = useCallback(() => {
    blurActiveElement();
    collapseIsland();
  }, [collapseIsland]);

  useEffect(() => {
    let disposed = false;
    let stop: (() => void) | null = null;
    void listenTodoQuickAddShortcut(() => {
      const current = latest.current;
      if (!current.enabled) return;
      if (current.pageMode !== "today") current.onShowToday();
      setSession((prev) => triggerQuickAdd(prev, { enabled: current.enabled, itemIds: current.itemIds }));
      current.openEnabledPage("todo");
    })
      .then((unlisten) => {
        if (disposed) unlisten();
        else stop = unlisten;
      })
      .catch((error: unknown) => console.error("Failed to listen for the todo quick-add shortcut", error));
    return () => {
      disposed = true;
      stop?.();
    };
  }, []);

  useEffect(() => {
    if (session.phase === "idle") return;
    const step = syncQuickAddIsland(session, { mode, page, pageMode, itemIds });
    if (step.session !== session) {
      setSession(step.session);
    }
    if (step.shouldCollapse) {
      collapseFromQuickAdd();
      return;
    }
    if (!step.shouldFocus) return;
    if (focusTodoComposer()) return;
    const frame = window.requestAnimationFrame(() => {
      focusTodoComposer();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [collapseFromQuickAdd, itemIds, mode, page, pageMode, session]);

  useEffect(() => {
    if (session.phase === "idle") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const step = cancelQuickAdd(session);
      if (!step.shouldCollapse) return;
      event.preventDefault();
      setSession(step.session);
      collapseFromQuickAdd();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [collapseFromQuickAdd, session]);
}
