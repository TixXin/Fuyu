import { useEffect, useMemo, useRef } from "react";
import type { WindowServices } from "@fuyu/plugin-base/client/window-services";
import { timersV1, type Timer } from "@fuyu/plugin-services";
import { builtinPlugins, isBuiltinEnabled } from "../plugin-kernel/builtinSwitches.ts";
import { windowServices } from "../plugin-kernel/services.ts";
import { MAX_FOCUS_TIMER_MINUTES, MIN_FOCUS_TIMER_MINUTES } from "./todoPrefs.ts";

export type FocusTimerServices = Pick<WindowServices, "get" | "has">;
export type FocusStopReason = "stopped" | "completed" | "removed";
export type FocusCreditKind = "due" | "stopped";

type ActiveFocusSession = {
  todoId: string;
  minutes: number;
};

export function clampFocusMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return 25;
  return Math.max(MIN_FOCUS_TIMER_MINUTES, Math.min(MAX_FOCUS_TIMER_MINUTES, Math.round(minutes)));
}

export function focusedMinutes(timer: Pick<Timer, "elapsedMs" | "runningSince">, at: number, limit: number): number {
  const elapsedMs = timer.elapsedMs + (timer.runningSince === null ? 0 : Math.max(0, at - timer.runningSince));
  return Math.max(0, Math.min(limit, Math.floor(elapsedMs / 60_000)));
}

export function createFocusTimerTracker({
  services = windowServices,
  isTimerPluginEnabled = () => isBuiltinEnabled(builtinPlugins(), "timer"),
  onFocusCompleted,
}: {
  services?: FocusTimerServices;
  isTimerPluginEnabled?: () => boolean;
  onFocusCompleted: (todoId: string, minutes: number, kind: FocusCreditKind) => void;
}) {
  const sessions = new Map<string, ActiveFocusSession>();
  const starting = new Map<string, number>();
  const earlyDueIds = new Set<string>();
  let starts = 0;
  let unlistenDue: (() => Promise<void>) | null = null;

  const removeTimer = (id: string) => services.get(timersV1).remove({ id }).then(() => undefined, () => undefined);

  function ensureSubscribed() {
    if (unlistenDue) return;
    unlistenDue = services.get(timersV1).on("due", ({ timer }) => {
      const session = sessions.get(timer.id);
      if (!session) {
        if (starting.size > 0) earlyDueIds.add(timer.id);
        return;
      }
      sessions.delete(timer.id);
      onFocusCompleted(session.todoId, session.minutes, "due");
    });
  }

  async function startFocus(todoId: string, rawMinutes: number): Promise<string | null> {
    if (!todoId || !isTimerPluginEnabled()) return null;
    ensureSubscribed();
    const minutes = clampFocusMinutes(rawMinutes);
    const token = ++starts;
    starting.set(todoId, token);
    try {
      await stopSessions(todoId, "removed");
      const { timer } = await services.get(timersV1).start({
        kind: "countdown",
        durationMs: minutes * 60_000,
      });
      if (starting.get(todoId) !== token) {
        earlyDueIds.delete(timer.id);
        await removeTimer(timer.id);
        return null;
      }
      if (earlyDueIds.delete(timer.id) || timer.alerted) {
        onFocusCompleted(todoId, minutes, "due");
        return timer.id;
      }
      sessions.set(timer.id, { todoId, minutes });
      return timer.id;
    } catch {
      return null;
    } finally {
      if (starting.get(todoId) === token) starting.delete(todoId);
      if (starting.size === 0) earlyDueIds.clear();
    }
  }

  async function stopSessions(todoId: string, reason: FocusStopReason) {
    const stopped = [...sessions].filter(([, session]) => session.todoId === todoId);
    if (stopped.length === 0) return;
    for (const [id] of stopped) sessions.delete(id);
    const listed = reason === "removed" ? null : await services.get(timersV1).list().catch(() => null);
    for (const [id, session] of stopped) {
      const timer = listed?.timers.find((item) => item.id === id);
      const minutes = timer && listed ? focusedMinutes(timer, listed.at, session.minutes) : 0;
      if (minutes > 0) onFocusCompleted(todoId, minutes, "stopped");
      await removeTimer(id);
    }
  }

  function stopFocus(todoId: string, reason: FocusStopReason = "stopped"): Promise<void> {
    starting.delete(todoId);
    return stopSessions(todoId, reason);
  }

  function dispose() {
    sessions.clear();
    starting.clear();
    earlyDueIds.clear();
    const stop = unlistenDue;
    unlistenDue = null;
    if (stop) void stop().catch(() => undefined);
  }

  return {
    ensureSubscribed,
    startFocus,
    stopFocus,
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
  onFocusCompleted: (todoId: string, minutes: number, kind: FocusCreditKind) => void;
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
        onFocusCompleted: (todoId, minutes, kind) => completedRef.current(todoId, minutes, kind),
      }),
    [],
  );

  useEffect(() => {
    if (enabled) tracker.ensureSubscribed();
  }, [enabled, tracker]);

  useEffect(() => () => tracker.dispose(), [tracker]);

  return useMemo(
    () => ({
      start: (todoId: string) => {
        if (enabledRef.current) void tracker.startFocus(todoId, minutesRef.current);
      },
      stop: (todoId: string, reason: FocusStopReason = "stopped") => {
        void tracker.stopFocus(todoId, reason);
      },
    }),
    [tracker],
  );
}
