import type { AlarmItem, AlarmSnapshot } from "../src/model.ts";
import { DEFAULT_SETTINGS } from "../src/settingsModel.ts";

const NOW = Date.parse("2026-11-19T10:24:00");
const WORKDAYS = [1, 2, 3, 4, 5];
const EVERYDAY = [0, 1, 2, 3, 4, 5, 6];

const alarm = (id: string, time: string, label: string, days: number[], enabled = true): AlarmItem => ({
  id,
  time,
  label,
  days,
  tone: "chime",
  enabled,
  lastFiredMinute: null,
});

const state: AlarmSnapshot = {
  alarms: [
    alarm("wake", "07:20", "起床", WORKDAYS),
    alarm("standup", "09:25", "晨会", WORKDAYS),
    alarm("nap", "13:30", "午休结束", WORKDAYS),
    alarm("swim", "18:45", "游泳课", [2, 4]),
    alarm("sleep", "22:40", "该睡了", EVERYDAY),
    alarm("tickets", "23:55", "抢演唱会门票", [], false),
  ],
  ringing: null,
  snoozed: null,
  settings: { ...DEFAULT_SETTINGS, timeFormat: "24", weekStart: "mon", barMode: "always" },
  at: NOW,
};

export default {
  now: NOW,
  host: {
    calls: {
      "alarm:get": state,
    },
  },
  shots: [
    { slot: "island.page/v1", file: "page.png" },
    { slot: "island.collapsed/v1", file: "bar.png" },
  ],
};
