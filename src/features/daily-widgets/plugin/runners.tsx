import { useEffect } from "react";
import { BUILTIN } from "@fuyu/plugin-base/client/slots";
import complete from "../../../assets/sounds/thumb-piano/complete.wav";
import { playSound } from "../../../lib/sound/playSound.ts";
import type { IslandContribution } from "../../plugin-kernel/islandContributions";
import { defineSlot } from "../../plugin-kernel/slots";
import { useIslandContributions } from "../../plugin-kernel/useIslandContributions";
import { settlePomodoro, useFinishedPomodoro } from "../pomodoro.ts";
import { useDaily } from "../store.ts";
import { POMODORO_NOTICE } from "./notice.ts";

const runnerSlot = defineSlot<object>("island.runner/v1");
const NONE: readonly IslandContribution[] = [];
const NOTICE: readonly IslandContribution[] = [{ kind: "notice", item: POMODORO_NOTICE }];

function PomodoroRunner() {
  const endsAt = useDaily().pomodoro.endsAt;
  const finished = useFinishedPomodoro();
  useEffect(() => {
    if (endsAt === null) return;
    const settle = () => {
      settlePomodoro(Date.now());
    };
    settle();
    const timer = window.setInterval(settle, 1000);
    return () => window.clearInterval(timer);
  }, [endsAt]);
  useEffect(() => {
    if (finished) void playSound(complete).catch((error: unknown) => console.error("Failed to play the pomodoro sound", error));
  }, [finished]);
  useIslandContributions(BUILTIN, "daily-widgets.pomodoro", finished ? NOTICE : NONE);
  return null;
}

runnerSlot.add({ id: "daily-widgets.pomodoro", component: PomodoroRunner });
