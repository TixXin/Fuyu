import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../../i18n";
import { visibilityInterval } from "../../lib/useVisibilityInterval";
import { readPresence } from "./api";
import { advanceBreaks, snoozedProgress, type BreakReminder, type BreakReminderSettings, type Presence } from "./breakReminders";
import { replaceIslandReminders } from "./reminders";
import { useBreakReminderSettings } from "./useBreakReminderSettings";

const TICK_MS = 15_000;
const SOURCE = "break";
const UNKNOWN: Presence = { idleSeconds: null, locked: false };

type Handlers = { onSnooze: () => void; onDismiss: () => void };

const sameItems = (a: readonly BreakReminder[], b: readonly BreakReminder[]) =>
  a.length === b.length && a.every((item, index) => item === b[index]);

export function useBreakReminders() {
  const [settings] = useBreakReminderSettings();
  const t = useTranslation().timer.breaks;
  const settingsRef = useRef<BreakReminderSettings>(settings);
  const progress = useRef<Record<string, number>>({});
  const handlers = useRef(new Map<string, Handlers>());
  const [due, setDue] = useState<readonly BreakReminder[]>([]);
  const running = settings.enabled && settings.items.some((item) => item.enabled);

  useEffect(() => {
    settingsRef.current = settings;
    const result = advanceBreaks(settings, progress.current, 0, UNKNOWN);
    progress.current = result.progress;
    setDue((current) => (sameItems(current, result.due) ? current : result.due));
  }, [settings]);

  useEffect(() => {
    if (!running) return;
    let last = Date.now();
    let cancelled = false;
    const tick = async () => {
      const presence = await readPresence().catch(() => UNKNOWN);
      if (cancelled) return;
      const now = Date.now();
      const result = advanceBreaks(settingsRef.current, progress.current, now - last, presence);
      last = now;
      progress.current = result.progress;
      setDue((current) => (sameItems(current, result.due) ? current : result.due));
    };
    const stop = visibilityInterval(() => void tick(), TICK_MS);
    return () => {
      cancelled = true;
      stop();
    };
  }, [running]);

  useEffect(() => {
    const handlersFor = (id: string): Handlers => {
      const known = handlers.current.get(id);
      if (known) return known;
      const settle = (elapsed: (item: BreakReminder) => number) => {
        const item = settingsRef.current.items.find((entry) => entry.id === id);
        if (item) progress.current = { ...progress.current, [id]: elapsed(item) };
        setDue((current) => current.filter((entry) => entry.id !== id));
      };
      const created = { onSnooze: () => settle(snoozedProgress), onDismiss: () => settle(() => 0) };
      handlers.current.set(id, created);
      return created;
    };
    const name = (item: BreakReminder) =>
      item.name.trim() || (item.id === "sit" ? t.sitName : item.id === "eyes" ? t.eyesName : t.iconNames[item.icon]);
    replaceIslandReminders(SOURCE, due.map((item) => ({
      id: `${SOURCE}:${item.id}`,
      source: SOURCE,
      icon: item.icon,
      title: name(item),
      detail: t.prompt[item.icon](item.minutes),
      snoozable: true,
      ...handlersFor(item.id),
    })));
  }, [due, t]);

  useEffect(() => () => replaceIslandReminders(SOURCE, []), []);
}
