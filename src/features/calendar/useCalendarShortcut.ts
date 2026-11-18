import { useCallback, useEffect, useMemo, useState } from "react";
import { setBuiltinConfig } from "../plugin-kernel/builtinSwitches";
import { useBuiltinConfig } from "../plugin-kernel/useBuiltinPlugins";
import { getCalendarShortcutProblem, listenCalendarShortcutProblem, type CalendarShortcutProblem } from "./api";
import {
  CALENDAR_JOIN_SHORTCUT_KEY,
  calendarShortcutConfigValue,
  readCalendarJoinShortcut,
  resolveJoinShortcutTarget,
  SUGGESTED_CALENDAR_SHORTCUT,
} from "./plugin/joinShortcut.ts";
import { OWNER } from "./plugin/owner.ts";

export {
  CALENDAR_JOIN_SHORTCUT_KEY,
  calendarShortcutConfigValue,
  readCalendarJoinShortcut,
  resolveJoinShortcutTarget,
  SUGGESTED_CALENDAR_SHORTCUT,
};

function saveCalendarShortcut(next: string) {
  void setBuiltinConfig(OWNER, CALENDAR_JOIN_SHORTCUT_KEY, calendarShortcutConfigValue(next)).catch((error: unknown) => {
    console.error("Could not save the calendar join shortcut", error);
  });
}

export function useCalendarJoinShortcut(): [string, (next: string) => void] {
  const raw = useBuiltinConfig(OWNER);
  const shortcut = useMemo(() => readCalendarJoinShortcut(raw), [raw]);
  const update = useCallback((next: string) => saveCalendarShortcut(next), []);
  return [shortcut, update];
}

export function useCalendarShortcutProblem() {
  const [problem, setProblem] = useState<CalendarShortcutProblem | null>(null);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | null = null;
    getCalendarShortcutProblem()
      .then((current) => {
        if (!cancelled) setProblem(current);
      })
      .catch((error: unknown) => console.error("Failed to read the calendar join shortcut", error));
    void listenCalendarShortcutProblem(setProblem)
      .then((unlisten) => {
        if (cancelled) unlisten();
        else stop = unlisten;
      })
      .catch((error: unknown) => console.error("Failed to listen for the calendar join shortcut", error));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  return problem;
}
