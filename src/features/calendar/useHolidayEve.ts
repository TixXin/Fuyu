import { remindersV1 } from "@fuyu/plugin-services";
import { useEffect } from "react";
import { useTranslation } from "../../i18n";
import { windowServices } from "../plugin-kernel/services";
import type { CalendarEvent } from "./api";
import { holidayEve } from "./holidayBreaks.ts";
import { loadEveReminded, saveEveReminded } from "./storage";

const reminders = windowServices.get(remindersV1);

export function useHolidayEve(enabled: boolean, events: readonly CalendarEvent[], now: number) {
  const text = useTranslation().calendar;

  useEffect(() => {
    if (!enabled || !windowServices.has(remindersV1.name)) return;
    const eve = holidayEve(events, new Date(now));
    if (!eve || loadEveReminded() === eve.date) return;
    saveEveReminded(eve.date);
    const work = eve.kind === "work";
    void reminders
      .push({
        id: `calendar.eve.${eve.date}`,
        source: "calendar",
        icon: work ? "bell" : "coffee",
        title: work ? text.eveWorkTitle : text.eveOffTitle(eve.name),
        detail: work ? text.dayTitle(new Date(`${eve.date}T00:00:00`)) : text.eveOffDetail(eve.length),
        snoozable: false,
      })
      .catch(() => undefined);
  }, [enabled, events, now, text]);
}
