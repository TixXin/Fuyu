import { useMemo } from "react";
import type { IslandContribution } from "../../plugin-kernel/islandContributions";
import { defineSlot } from "../../plugin-kernel/slots";
import { useIslandContributions } from "../../plugin-kernel/useIslandContributions";
import { useBreakReminders } from "../useBreakReminders";
import { useIslandReminder } from "../useIslandReminder";
import { useIslandTimer } from "../useIslandTimer";
import { useTimerEngine } from "../useTimerEngine";
import { timerIsland } from "./islandState";
import { OWNER } from "./owner.ts";

type IslandRunnerProps = {
  features: { timer?: boolean };
  openEnabledPage: (page: "timer") => void;
};

const runnerSlot = defineSlot<object>("island.runner/v1");

function TimerEngine() {
  useTimerEngine();
  return null;
}

function BreakReminders() {
  useBreakReminders();
  return null;
}

function TimerIsland({ features, openEnabledPage }: IslandRunnerProps) {
  const { ringing } = useIslandTimer(features.timer === true, openEnabledPage);
  const reminder = useIslandReminder();
  timerIsland.useProvide(useMemo(() => ({ ringing, reminder }), [ringing, reminder]));
  const list: IslandContribution[] = [];
  if (ringing.length > 0) list.push({ kind: "notice", item: "timer" });
  if (reminder) list.push({ kind: "notice", item: "reminder" });
  useIslandContributions(OWNER, "timer.island", list);
  return null;
}

const islandRunnerSlot = defineSlot<IslandRunnerProps>("island.runner/v1");

runnerSlot.add({ id: "timer.engine", component: TimerEngine }, OWNER);
runnerSlot.add({ id: "timer.break-reminders", component: BreakReminders }, OWNER);
islandRunnerSlot.add({ id: "timer.island", component: TimerIsland }, OWNER);
