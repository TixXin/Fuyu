export type TimerText = {
  placeholder: string;
  start: string;
  stopwatch: string;
  invalid: string;
  full: string;
  empty: string;
  countdown: string;
  stopwatchLabel: string;
  pause: string;
  resume: string;
  cancel: string;
  extend: string;
  dismiss: string;
  ended: string;
  timeUp: (length: string) => string;
  moreUp: (count: number) => string;
  chip: string;
};

export const zhCN: TimerText = {
  placeholder: "10、10m、1h30m、90s",
  start: "开始倒计时",
  stopwatch: "开始秒表",
  invalid: "看不懂这个时长，试试 10、10m、1h30m 或 90s（最长 24 小时）",
  full: "最多同时 12 个计时",
  empty: "输入时长开始倒计时，或开一个秒表",
  countdown: "倒计时",
  stopwatchLabel: "秒表",
  pause: "暂停",
  resume: "继续",
  cancel: "取消",
  extend: "再加 5 分钟",
  dismiss: "知道了",
  ended: "到点了",
  timeUp: (length) => `${length} 的计时到了`,
  moreUp: (count) => `还有 ${count} 个也到了`,
  chip: "打开计时器",
};

export const en: TimerText = {
  placeholder: "10, 10m, 1h30m, 90s",
  start: "Start countdown",
  stopwatch: "Start stopwatch",
  invalid: "Couldn't read that; try 10, 10m, 1h30m or 90s (up to 24 hours)",
  full: "Up to 12 timers at once",
  empty: "Type a length to start a countdown, or start a stopwatch",
  countdown: "Countdown",
  stopwatchLabel: "Stopwatch",
  pause: "Pause",
  resume: "Resume",
  cancel: "Cancel",
  extend: "5 more minutes",
  dismiss: "Done",
  ended: "Time's up",
  timeUp: (length) => `Your ${length} timer is up`,
  moreUp: (count) => `${count} more ${count === 1 ? "is" : "are"} up too`,
  chip: "Open the timer",
};
