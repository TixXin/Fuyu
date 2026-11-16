import { defineSlot } from "../../plugin-kernel/slots";
import { useBreakReminders } from "../useBreakReminders";
import { useTimerEngine } from "../useTimerEngine";
import { OWNER } from "./owner.ts";

const runnerSlot = defineSlot<object>("island.runner/v1");

function TimerEngine() {
  useTimerEngine();
  return null;
}

function BreakReminders() {
  useBreakReminders();
  return null;
}

runnerSlot.add({ id: "timer.engine", component: TimerEngine }, OWNER);
runnerSlot.add({ id: "timer.break-reminders", component: BreakReminders }, OWNER);
