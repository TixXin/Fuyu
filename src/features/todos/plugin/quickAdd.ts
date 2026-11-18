export const TODO_QUICK_ADD_SHORTCUT_KEY = "quickAddShortcut";
export const SUGGESTED_TODO_SHORTCUT = "Alt+Shift+T";

export function readTodoQuickAddShortcut(config: Readonly<Record<string, unknown>>): string {
  const value = config[TODO_QUICK_ADD_SHORTCUT_KEY];
  return typeof value === "string" ? value.trim() : "";
}

export function todoShortcutConfigValue(next: string): string | null {
  const trimmed = next.trim();
  return trimmed ? trimmed : null;
}

export type QuickAddSession =
  | { phase: "idle"; requestId: number }
  | { phase: "opening" | "active"; requestId: number; focusedRequestId: number; knownIds: ReadonlySet<string> };

export const IDLE_QUICK_ADD: QuickAddSession = Object.freeze({ phase: "idle", requestId: 0 });

export function triggerQuickAdd(
  session: QuickAddSession,
  options: { enabled: boolean; itemIds: readonly string[] },
): QuickAddSession {
  if (!options.enabled) return IDLE_QUICK_ADD;
  const requestId = session.requestId + 1;
  const knownIds = session.phase === "idle" ? new Set(options.itemIds) : session.knownIds;
  return {
    phase: session.phase === "active" ? "active" : "opening",
    requestId,
    focusedRequestId: session.phase === "idle" ? 0 : session.focusedRequestId,
    knownIds,
  };
}

export type QuickAddStep = {
  session: QuickAddSession;
  shouldFocus: boolean;
  shouldCollapse: boolean;
};

export function syncQuickAddIsland(
  session: QuickAddSession,
  snapshot: { mode: string; page: string; pageMode: string; itemIds: readonly string[] },
): QuickAddStep {
  if (session.phase === "idle") {
    return { session, shouldFocus: false, shouldCollapse: false };
  }
  if (snapshot.itemIds.some((id) => !session.knownIds.has(id))) {
    return {
      session: { phase: "idle", requestId: session.requestId },
      shouldFocus: false,
      shouldCollapse: true,
    };
  }
  const onTodoToday = snapshot.mode === "expanded" && snapshot.page === "todo" && snapshot.pageMode === "today";
  if (session.phase === "opening") {
    if (!onTodoToday) {
      return { session, shouldFocus: false, shouldCollapse: false };
    }
    return {
      session: { ...session, phase: "active", focusedRequestId: session.requestId },
      shouldFocus: true,
      shouldCollapse: false,
    };
  }
  if (snapshot.mode !== "expanded" || snapshot.page !== "todo") {
    return {
      session: { phase: "idle", requestId: session.requestId },
      shouldFocus: false,
      shouldCollapse: false,
    };
  }
  if (onTodoToday && session.focusedRequestId !== session.requestId) {
    return {
      session: { ...session, focusedRequestId: session.requestId },
      shouldFocus: true,
      shouldCollapse: false,
    };
  }
  return { session, shouldFocus: false, shouldCollapse: false };
}

export function cancelQuickAdd(session: QuickAddSession): QuickAddStep {
  if (session.phase === "idle") {
    return { session, shouldFocus: false, shouldCollapse: false };
  }
  return {
    session: { phase: "idle", requestId: session.requestId },
    shouldFocus: false,
    shouldCollapse: true,
  };
}
