import type { TimerKind } from "@fuyu/plugin-services";

const en = {
  title: "{{displayNameEn}}",
  start: (length: string) => `Start a ${length} countdown`,
  empty: "No timers yet",
  kind: { countdown: "Countdown", stopwatch: "Stopwatch" } satisfies Record<TimerKind, string>,
  summary: (total: number, running: number) => `${total} timers, ${running} running`,
  dismiss: (ringing: number) => (ringing > 0 ? `Dismiss ${ringing} finished` : "Nothing to dismiss"),
};

const zhCN: typeof en = {
  title: "{{displayNameZh}}",
  start: (length: string) => `开始 ${length} 倒计时`,
  empty: "还没有计时器",
  kind: { countdown: "倒计时", stopwatch: "秒表" },
  summary: (total: number, running: number) => `共 ${total} 个计时器，${running} 个在走`,
  dismiss: (ringing: number) => (ringing > 0 ? `清掉 ${ringing} 个已到点的` : "没有已到点的"),
};

export const text = navigator.language.toLowerCase().startsWith("zh") ? zhCN : en;
