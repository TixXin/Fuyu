import type { ComponentType } from "react";
import { defineSlot, type IslandWidgetMeta, type IslandWidgetProps } from "../../plugin-kernel/slots";
import type { BuiltinWidget } from "../../plugin-kernel/widgetCatalog";
import { FocusWidget, PomodoroWidget, StreakWidget } from "../FocusWidgets";
import { CountdownWidget } from "../CountdownWidget";
import { HabitsWidget } from "../HabitsWidget";
import { NoteWidget, WaterWidget } from "../RoutineWidgets";
import { SunWidget } from "../SunWidget";
import { YearWidget } from "../TimeWidgets";
import { WorldClockWidget } from "../WorldClockWidget";
import { TodayWidget } from "../TodayWidget";
import { COUNTDOWN_WIDGET, FOCUS_WIDGET, HABITS_WIDGET, NOTE_WIDGET, POMODORO_WIDGET, STREAK_WIDGET, SUN_WIDGET, TODAY_WIDGET, WATER_WIDGET, WORLD_CLOCK_WIDGET, YEAR_WIDGET } from "./widgets.ts";
import "../dailyWidgets.css";
import "../dailyEditing.css";

const widgetSlot = defineSlot<IslandWidgetProps, IslandWidgetMeta>("island.widget/v1");

const COMPONENTS: readonly [BuiltinWidget, ComponentType<IslandWidgetProps>][] = [
  [TODAY_WIDGET, TodayWidget],
  [POMODORO_WIDGET, PomodoroWidget],
  [STREAK_WIDGET, StreakWidget],
  [FOCUS_WIDGET, FocusWidget],
  [HABITS_WIDGET, HabitsWidget],
  [WATER_WIDGET, WaterWidget],
  [NOTE_WIDGET, NoteWidget],
  [COUNTDOWN_WIDGET, CountdownWidget],
  [WORLD_CLOCK_WIDGET, WorldClockWidget],
  [SUN_WIDGET, SunWidget],
  [YEAR_WIDGET, YearWidget],
];

for (const [widget, component] of COMPONENTS) widgetSlot.add({ ...widget, component });
