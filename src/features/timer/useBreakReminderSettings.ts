import { useCallback, useEffect, useState } from "react";
import type { BreakReminderSettings } from "./breakReminders";
import { BREAK_REMINDERS_KEY, loadBreakReminders, saveBreakReminders } from "./storage";

export function useBreakReminderSettings() {
  const [settings, setSettings] = useState<BreakReminderSettings>(loadBreakReminders);

  useEffect(() => {
    const syncFromOtherWindow = (event: StorageEvent) => {
      if (event.key === BREAK_REMINDERS_KEY) setSettings(loadBreakReminders());
    };
    window.addEventListener("storage", syncFromOtherWindow);
    return () => window.removeEventListener("storage", syncFromOtherWindow);
  }, []);

  const update = useCallback((next: BreakReminderSettings) => {
    setSettings(next);
    saveBreakReminders(next);
  }, []);

  return [settings, update] as const;
}
