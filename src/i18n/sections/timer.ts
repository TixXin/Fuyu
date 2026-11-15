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
  breaks: BreakText;
};

type BreakIconText = Record<"stand" | "eye" | "water" | "stretch" | "coffee" | "bell", string>;

export type BreakText = {
  title: string;
  toggle: string;
  hint: string;
  sitName: string;
  eyesName: string;
  iconNames: BreakIconText;
  prompt: Record<keyof BreakIconText, (minutes: number) => string>;
  name: string;
  minutes: string;
  unit: string;
  changeIcon: string;
  enableItem: string;
  remove: string;
  add: string;
  full: string;
  empty: string;
  snooze: string;
  skip: string;
  more: (count: number) => string;
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
  breaks: {
    title: "休息提醒",
    toggle: "休息提醒",
    hint: "按间隔在岛上提醒起身、远眺。锁屏或离开 5 分钟以上时不计时，全屏时等退出再提醒",
    sitName: "久坐",
    eyesName: "护眼",
    iconNames: { stand: "起来走走", eye: "看看远处", water: "喝水", stretch: "伸展", coffee: "歇一会儿", bell: "提醒" },
    prompt: {
      stand: (minutes) => `坐了 ${minutes} 分钟，起来走走`,
      eye: () => "看看 6 米外，放松 20 秒",
      water: () => "喝口水吧",
      stretch: () => "伸展一下肩颈",
      coffee: () => "歇一会儿",
      bell: (minutes) => `${minutes} 分钟到了`,
    },
    name: "提醒名称",
    minutes: "间隔",
    unit: "分钟",
    changeIcon: "换个图标",
    enableItem: "启用这项提醒",
    remove: "删除这项提醒",
    add: "添加提醒",
    full: "最多 8 项",
    empty: "还没有提醒项",
    snooze: "5 分钟后再提醒",
    skip: "跳过",
    more: (count) => `还有 ${count} 条`,
  },
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
  breaks: {
    title: "Break reminders",
    toggle: "Break reminders",
    hint: "Reminds you on the island to get up or look away. Doesn't count while the screen is locked or you've been away 5+ minutes, and waits until you leave full screen",
    sitName: "Stand up",
    eyesName: "Rest your eyes",
    iconNames: { stand: "Move around", eye: "Look away", water: "Drink water", stretch: "Stretch", coffee: "Take a break", bell: "Reminder" },
    prompt: {
      stand: (minutes) => `${minutes} minutes sitting; time to move`,
      eye: () => "Look 20 feet away for 20 seconds",
      water: () => "Have some water",
      stretch: () => "Stretch your neck and shoulders",
      coffee: () => "Take a short break",
      bell: (minutes) => `${minutes} minutes are up`,
    },
    name: "Reminder name",
    minutes: "Interval",
    unit: "min",
    changeIcon: "Change icon",
    enableItem: "Turn this reminder on",
    remove: "Remove this reminder",
    add: "Add reminder",
    full: "Up to 8",
    empty: "No reminders yet",
    snooze: "Remind me in 5 minutes",
    skip: "Skip",
    more: (count) => `${count} more`,
  },
};
