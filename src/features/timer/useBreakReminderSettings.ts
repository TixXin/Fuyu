import { useCallback, useEffect, useState } from "react";
import type { BreakReminderSettings } from "./breakReminders";
import { BREAK_REMINDERS_KEY, loadBreakReminders, saveBreakReminders } from "./storage";

const listeners = new Set<(next: BreakReminderSettings) => void>();

export function useBreakReminderSettings() {
  const [settings, setSettings] = useState<BreakReminderSettings>(loadBreakReminders);

  useEffect(() => {
    const onLocal = (next: BreakReminderSettings) => setSettings(next);
    const syncFromOtherWindow = (event: StorageEvent) => {
      if (event.key === BREAK_REMINDERS_KEY) setSettings(loadBreakReminders());
    };
    listeners.add(onLocal);
    window.addEventListener("storage", syncFromOtherWindow);
    return () => {
      listeners.delete(onLocal);
      window.removeEventListener("storage", syncFromOtherWindow);
    };
  }, []);

  const update = useCallback((next: BreakReminderSettings) => {
    setSettings(next);
    saveBreakReminders(next);
    for (const listener of listeners) listener(next);
  }, []);

  return [settings, update] as const;
}
