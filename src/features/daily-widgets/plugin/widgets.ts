import { AlarmClock, Droplets, Flame, Globe, Hourglass, PartyPopper, Repeat, StickyNote, Sun, Sunrise, Target } from "lucide-react";
import { BUILTIN } from "@fuyu/plugin-base/client/slots";
import type { DailyWidgetsText } from "../../../i18n/sections/dailyWidgets";
import type { BuiltinWidget } from "../../plugin-kernel/widgetCatalog";

type Name = keyof DailyWidgetsText["names"];

const daily = (id: string, icon: BuiltinWidget["icon"], sizes: BuiltinWidget["sizes"], order: number, name: Name): BuiltinWidget => ({
  id,
  icon,
  owner: BUILTIN,
  group: "daily",
  sizes,
  order,
  label: (t) => t.islandWidgets.daily.names[name],
});

export const TODAY_WIDGET = daily("today", Sun, ["l"], 100, "today");
export const POMODORO_WIDGET = daily("pomodoro", AlarmClock, ["s"], 110, "pomodoro");
export const STREAK_WIDGET = daily("streak", Flame, ["s"], 120, "streak");
export const FOCUS_WIDGET = daily("focus-stats", Target, ["s"], 130, "focus");
export const HABITS_WIDGET = daily("habits", Repeat, ["m"], 140, "habits");
export const WATER_WIDGET = daily("water", Droplets, ["s"], 150, "water");
export const NOTE_WIDGET = daily("note", StickyNote, ["m", "l"], 160, "note");
export const COUNTDOWN_WIDGET = daily("countdown", PartyPopper, ["s"], 170, "countdown");
export const WORLD_CLOCK_WIDGET = daily("world-clock", Globe, ["s"], 180, "worldClock");
export const SUN_WIDGET = daily("sun", Sunrise, ["s"], 190, "sun");
export const YEAR_WIDGET = daily("year-progress", Hourglass, ["s"], 200, "year");

export const islandWidgets: readonly BuiltinWidget[] = [
  TODAY_WIDGET,
  POMODORO_WIDGET,
  STREAK_WIDGET,
  FOCUS_WIDGET,
  HABITS_WIDGET,
  WATER_WIDGET,
  NOTE_WIDGET,
  COUNTDOWN_WIDGET,
  WORLD_CLOCK_WIDGET,
  SUN_WIDGET,
  YEAR_WIDGET,
];
