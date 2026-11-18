import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeCalendarPrefs, type CalendarPrefs } from "./calendarPrefs.ts";
import { CALENDAR_PREFS_KEY, loadCalendarPrefs, saveCalendarPrefs } from "./storage.ts";

const CHANGED_EVENT = "fuyu-calendar-prefs-changed";

export function useCalendarPrefs() {
  const [prefs, setPrefs] = useState<CalendarPrefs>(loadCalendarPrefs);
  const self = useRef({});

  useEffect(() => {
    const reload = () => {
      const stored = loadCalendarPrefs();
      setPrefs((current) => (JSON.stringify(current) === JSON.stringify(stored) ? current : stored));
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === CALENDAR_PREFS_KEY || event.key === null) reload();
    };
    const onSameWindow = (event: Event) => {
      if ((event as CustomEvent).detail !== self.current) reload();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(CHANGED_EVENT, onSameWindow);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CHANGED_EVENT, onSameWindow);
    };
  }, []);

  const update = useCallback((next: CalendarPrefs | ((current: CalendarPrefs) => CalendarPrefs)) => {
    setPrefs((current) => {
      const resolved = normalizeCalendarPrefs(typeof next === "function" ? next(current) : next);
      saveCalendarPrefs(resolved);
      window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: self.current }));
      return resolved;
    });
  }, []);

  return [prefs, update] as const;
}
