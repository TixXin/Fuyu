import { defineSlot } from "../../plugin-kernel/slots";
import { useBreakReminders } from "../useBreakReminders";

const runnerSlot = defineSlot<object>("island.runner/v1");

function BreakReminders() {
  useBreakReminders();
  return null;
}

runnerSlot.add({ id: "timer.break-reminders", component: BreakReminders });
