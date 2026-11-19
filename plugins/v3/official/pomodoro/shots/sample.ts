import { DEFAULT_SETTINGS, type PomodoroSnapshot } from "../src/model.ts";

const NOW = Date.parse("2026-11-19T10:24:00");
const FOCUS_MS = 25 * 60_000;
const ELAPSED_MS = 12 * 60_000 + 18_000;

const state: PomodoroSnapshot = {
  timer: {
    id: "pomodoro-focus",
    kind: "countdown",
    durationMs: FOCUS_MS,
    elapsedMs: 0,
    runningSince: NOW - ELAPSED_MS,
    alerted: false,
    owner: "@fuyu/pomodoro",
    hidden: true,
  },
  at: NOW,
  phase: "focus",
  activeTodoId: "slides",
  activeLabel: "写完季度复盘的 PPT",
  rounds: 3,
  breakDue: null,
  openTodos: [
    { id: "slides", title: "写完季度复盘的 PPT" },
    { id: "review", title: "看完小林的合并请求" },
    { id: "mail", title: "回复客户的报价邮件" },
    { id: "ticket", title: "订周末回家的高铁票" },
  ],
  settings: { ...DEFAULT_SETTINGS, dailyGoal: 8, showInBar: true },
  timersHidden: true,
};

export default {
  now: NOW,
  host: {
    calls: {
      snapshot: state,
    },
  },
  shots: [
    { slot: "island.page/v1", file: "page.png" },
    { slot: "island.collapsed/v1", file: "bar.png" },
  ],
};
