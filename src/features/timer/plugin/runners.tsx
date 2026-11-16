import { remindersV1 } from "@fuyu/plugin-services";
import { defineSlot } from "../../plugin-kernel/slots";
import { windowServices } from "../../plugin-kernel/services";
import { readReminder } from "../reminderParams";
import { pushIslandReminder } from "../reminders";
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

windowServices.provide(remindersV1, {
  push: (params) => {
    const reminder = readReminder(params);
    if (!reminder) throw Object.assign(new Error("a reminder needs an id, a source, a known icon and a title"), { code: "bad-params" });
    pushIslandReminder(reminder);
    return { shown: true };
  },
}, { owner: OWNER });
