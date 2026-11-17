import type { AlarmTone } from "./model.ts";

const en = {
  title: "Alarm",
  empty: "No alarms set yet.",
  labelPlaceholder: "Alarm label",
  add: "Add",
  remove: "Delete",
  dismiss: "Dismiss",
  snooze: "Snooze 5m",
  preview: "Test sound",
  once: "Once",
  everyday: "Every day",
  ringingNow: "Ringing",
  weekdays: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
  tones: {
    chime: "Warm chime",
    bell: "Crystal bell",
    digital: "Digital pulse",
    mute: "Silent",
  } satisfies Record<AlarmTone, string>,
  defaultTone: "Default ringtone",
  showInBar: "Show next alarm on collapsed bar",
  summary: (total: number, active: number) => `${active} active of ${total} alarm(s)`,
};

const zhCN: typeof en = {
  title: "闹钟",
  empty: "还没有设置闹钟。",
  labelPlaceholder: "闹钟备注",
  add: "添加",
  remove: "删除",
  dismiss: "关闭响铃",
  snooze: "贪睡 5 分钟",
  preview: "试听铃声",
  once: "单次",
  everyday: "每天",
  ringingNow: "响铃中",
  weekdays: ["日", "一", "二", "三", "四", "五", "六"],
  tones: {
    chime: "柔和风铃",
    bell: "清脆钟声",
    digital: "电子脉冲",
    mute: "静音提醒",
  } satisfies Record<AlarmTone, string>,
  defaultTone: "默认铃声",
  showInBar: "在收起条显示下一次闹钟",
  summary: (total: number, active: number) => `共 ${total} 个闹钟，${active} 个已开启`,
};

const isZh = typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh");

export const text = isZh ? zhCN : en;
