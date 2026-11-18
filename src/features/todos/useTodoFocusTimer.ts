import { useCallback, useEffect, useMemo, useRef } from "react";
import type { WindowServices } from "@fuyu/plugin-base/client/window-services";
import { timersV1 } from "@fuyu/plugin-services";
import { builtinPlugins, isBuiltinEnabled } from "../plugin-kernel/builtinSwitches.ts";
import { windowServices } from "../plugin-kernel/services.ts";
import { MAX_FOCUS_TIMER_MINUTES, MIN_FOCUS_TIMER_MINUTES } from "./todoPrefs.ts";

export type FocusTimerServices = Pick<WindowServices, "get" | "has">;

type ActiveFocusSession = {
  todoId: string;
  minutes: number;
};

export function clampFocusMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return 25;
  return Math.max(MIN_FOCUS_TIMER_MINUTES, Math.min(MAX_FOCUS_TIMER_MINUTES, Math.round(minutes)));
}

export function createFocusTimerTracker({
  services = windowServices,
  isTimerPluginEnabled = () => isBuiltinEnabled(builtinPlugins(), "timer"),
  onFocusCompleted,
}: {
  services?: FocusTimerServices;
  isTimerPluginEnabled?: () => boolean;
  onFocusCompleted: (todoId: string, minutes: number) => void;
}) {
  const sessions = new Map<string, ActiveFocusSession>();
  const earlyDueIds = new Set<string>();
  let unlistenDue: (() => Promise<void>) | null = null;

  function ensureSubscribed() {
    if (unlistenDue) return;
    unlistenDue = services.get(timersV1).on("due", ({ timer }) => {
      const session = sessions.get(timer.id);
      if (!session) {
        earlyDueIds.add(timer.id);
        return;
      }
      sessions.delete(timer.id);
      onFocusCompleted(session.todoId, session.minutes);
    });
  }

  async function startFocus(todoId: string, rawMinutes: number): Promise<string | null> {
    if (!todoId || !isTimerPluginEnabled()) return null;
    ensureSubscribed();
    const minutes = clampFocusMinutes(rawMinutes);
    try {
      const { timer } = await services.get(timersV1).start({
        kind: "countdown",
        durationMs: minutes * 60_000,
      });
      if (earlyDueIds.delete(timer.id) || timer.alerted) {
        onFocusCompleted(todoId, minutes);
        return timer.id;
      }
      sessions.set(timer.id, { todoId, minutes });
      return timer.id;
    } catch {
      return null;
    }
  }

  function dispose() {
    sessions.clear();
    earlyDueIds.clear();
    const stop = unlistenDue;
    unlistenDue = null;
    if (stop) void stop().catch(() => undefined);
  }

  return {
    ensureSubscribed,
    startFocus,
    dispose,
    activeCount: () => sessions.size,
  };
}

export function useTodoFocusTimer({
  enabled,
  focusMinutes,
  onFocusCompleted,
}: {
  enabled: boolean;
  focusMinutes: number;
  onFocusCompleted: (todoId: string, minutes: number) => void;
}) {
  const enabledRef = useRef(enabled);
  const minutesRef = useRef(focusMinutes);
  const completedRef = useRef(onFocusCompleted);
  enabledRef.current = enabled;
  minutesRef.current = focusMinutes;
  completedRef.current = onFocusCompleted;

  const tracker = useMemo(
    () =>
      createFocusTimerTracker({
        onFocusCompleted: (todoId, minutes) => completedRef.current(todoId, minutes),
      }),
    [],
  );

  useEffect(() => {
    if (enabled) tracker.ensureSubscribed();
  }, [enabled, tracker]);

  useEffect(() => () => tracker.dispose(), [tracker]);

  return useCallback(
    (todoId: string) => {
      if (!enabledRef.current) return;
      void tracker.startFocus(todoId, minutesRef.current);
    },
    [tracker],
  );
}
