export type TimerLayoutId = "split" | "dial" | "grid" | "hub";

export type TimerLayoutText = {
  title: string;
  hint: string;
  options: Record<TimerLayoutId, { name: string; hint: string }>;
};

export type TimerPanelText = {
  presetTags: Record<1 | 3 | 5 | 10 | 15 | 25, string>;
  minuteShort: (minutes: number) => string;
  hourShort: (hours: number) => string;
  minutesFull: (minutes: number) => string;
  addOneMin: string;
  addFiveMin: string;
  stepMinusOne: string;
  stepPlusOne: string;
  stepPlusFive: string;
  etaAt: (time: string) => string;
  etaShort: (time: string) => string;
  previewLabel: string;
  quickSetLabel: string;
  pressEnterStart: string;
  pickPresetOrAdjust: string;
  startWithLength: (clock: string) => string;
  remainingLabel: string;
  elapsedLabel: string;
  pausedLabel: string;
  runningLabel: string;
  stopwatchRunning: string;
  stopwatchPaused: string;
  newStopwatch: string;
  activeCount: (count: number, max: number) => string;
  hasDue: string;
  sortedHint: string;
  soundOn: string;
  soundOff: string;
  hoursUnit: string;
  minutesUnit: string;
  secondsUnit: string;
  increaseUnit: (unit: string) => string;
  decreaseUnit: (unit: string) => string;
  allCountdowns: (count: number) => string;
  lap: string;
  lapsTitle: string;
  lapsCount: (count: number) => string;
  lapsEmpty: string;
  resetStopwatch: string;
  tapToStart: string;
  ringingHint: string;
  hubTitle: string;
  hubSub: string;
  focusPreset: string;
  recentLabel: string;
  breakRemaining: (minutes: number) => string;
  breakReset: string;
  breakFooterOn: string;
  breakFooterOff: string;
  breakEmpty: string;
  layoutButton: (name: string) => string;
};

export type TimerText = {
  placeholder: string;
  start: string;
  stopwatch: string;
  invalid: string;
  full: string;
  unavailable: string;
  empty: string;
  countdown: string;
  stopwatchLabel: string;
  pause: string;
  resume: string;
  cancel: string;
  extend: string;
  dismiss: string;
  ended: string;
  from: (name: string) => string;
  timeUp: (length: string) => string;
  moreUp: (count: number) => string;
  chip: string;
  quickPreset: (minutes: number) => string;
  quickStart: (minutes: number) => string;
  layout: TimerLayoutText;
  panel: TimerPanelText;
  breaks: BreakText;
  settings: TimerSettingsText;
};

export type TimerSettingsText = {
  title: string;
  sound: string;
  soundHint: string;
  shortcut: string;
  shortcutHint: string;
  shortcutOff: string;
  setShortcut: string;
  turnOffShortcut: string;
  shortcutProblem: Record<"invalid" | "taken", string>;
  shortcutInvalidMac: string;
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
  unavailable: "插件还没准备好，稍后再试",
  empty: "输入时长开始倒计时，或开一个秒表",
  countdown: "倒计时",
  stopwatchLabel: "秒表",
  pause: "暂停",
  resume: "继续",
  cancel: "取消",
  extend: "再加 5 分钟",
  dismiss: "知道了",
  ended: "到点了",
  from: (name) => `来自 ${name}`,
  timeUp: (length) => `${length} 的计时到了`,
  moreUp: (count) => `还有 ${count} 个也到了`,
  chip: "打开计时器",
  quickPreset: (minutes) => `${minutes}分`,
  quickStart: (minutes) => `开始 ${minutes} 分钟倒计时`,
  layout: {
    title: "计时器页布局",
    hint: "也可以直接在岛上计时器页的布局按钮里随时切换",
    options: {
      split: { name: "左右双栏", hint: "左侧速启预设，右侧实时表盘与列表" },
      dial: { name: "双模式大表盘", hint: "倒计时与秒表独立大表盘，支持计次" },
      grid: { name: "速启卡片网格", hint: "预设磁贴一键启动，运行中整卡进度" },
      hub: { name: "时间中枢", hint: "计时器与休息提醒实时进度同屏展示" },
    },
  },
  panel: {
    presetTags: { 1: "极速", 3: "泡茶", 5: "短休", 10: "小憩", 15: "会议", 25: "专注" },
    minuteShort: (minutes) => `${minutes}m`,
    hourShort: (hours) => `${hours}h`,
    minutesFull: (minutes) => `${minutes} 分钟`,
    addOneMin: "+1 分",
    addFiveMin: "+5 分",
    stepMinusOne: "-1 分",
    stepPlusOne: "+1 分",
    stepPlusFive: "+5 分",
    etaAt: (time) => `预计 ${time} 到点`,
    etaShort: (time) => `预计 ${time}`,
    previewLabel: "输入预览",
    quickSetLabel: "快速设定",
    pressEnterStart: "按 Enter 立即开始",
    pickPresetOrAdjust: "点左侧预设，或微调时长",
    startWithLength: (clock) => `开始 ${clock}`,
    remainingLabel: "剩余",
    elapsedLabel: "已计时",
    pausedLabel: "已暂停",
    runningLabel: "进行中",
    stopwatchRunning: "正向计时中",
    stopwatchPaused: "秒表已暂停",
    newStopwatch: "再开秒表",
    activeCount: (count, max) => `进行中 · ${count} / ${max}`,
    hasDue: "有倒计时已到点",
    sortedHint: "按状态排序",
    soundOn: "到点提示音：开",
    soundOff: "到点提示音：关",
    hoursUnit: "小时",
    minutesUnit: "分钟",
    secondsUnit: "秒",
    increaseUnit: (unit) => `增加${unit}`,
    decreaseUnit: (unit) => `减少${unit}`,
    allCountdowns: (count) => `全部倒计时 (${count})`,
    lap: "计次",
    lapsTitle: "分段计次",
    lapsCount: (count) => `${count} 条`,
    lapsEmpty: "开始后点「计次」记录分段",
    resetStopwatch: "复位秒表",
    tapToStart: "点一下立即开始",
    ringingHint: "点击加时或关闭",
    hubTitle: "随时起一个倒计时",
    hubSub: "输入时长按 Enter，或点上方预设开始",
    focusPreset: "25 分钟专注",
    recentLabel: "最近使用",
    breakRemaining: (minutes) => `${minutes}分后`,
    breakReset: "重新计时这项休息提醒",
    breakFooterOn: "离开 5 分钟自动暂停计时",
    breakFooterOff: "已关闭 · 开启后按间隔提醒起身与护眼",
    breakEmpty: "暂无启用的提醒项",
    layoutButton: (name) => `计时器布局：${name}`,
  },
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
  settings: {
    title: "计时器",
    sound: "到点响一声",
    soundHint: "倒计时到点时，除了岛上的提醒再响一声",
    shortcut: "打开计时器",
    shortcutHint: "在任何地方按下都会展开岛并打开计时器页，光标落在时长输入框里。",
    shortcutOff: "未设置",
    setShortcut: "设置快捷键",
    turnOffShortcut: "关闭快捷键",
    shortcutProblem: { invalid: "这个快捷键用不了，换一个带修饰键的组合。", taken: "这个快捷键被别的程序占用了，换一个。" },
    shortcutInvalidMac: "这个快捷键在 Mac 上用不了，换一个带 Control、Option 或 Command 的组合。",
  },
};

export const en: TimerText = {
  placeholder: "10, 10m, 1h30m, 90s",
  start: "Start countdown",
  stopwatch: "Start stopwatch",
  invalid: "Couldn't read that; try 10, 10m, 1h30m or 90s (up to 24 hours)",
  full: "Up to 12 timers at once",
  unavailable: "Plugins aren't ready yet; try again in a moment",
  empty: "Type a length to start a countdown, or start a stopwatch",
  countdown: "Countdown",
  stopwatchLabel: "Stopwatch",
  pause: "Pause",
  resume: "Resume",
  cancel: "Cancel",
  extend: "5 more minutes",
  dismiss: "Done",
  ended: "Time's up",
  from: (name) => `from ${name}`,
  timeUp: (length) => `Your ${length} timer is up`,
  moreUp: (count) => `${count} more ${count === 1 ? "is" : "are"} up too`,
  chip: "Open the timer",
  quickPreset: (minutes) => `${minutes}m`,
  quickStart: (minutes) => `Start a ${minutes}-minute timer`,
  layout: {
    title: "Timer layout",
    hint: "You can also switch layouts anytime from the timer page on the island",
    options: {
      split: { name: "Split studio", hint: "Quick presets on the left, live dial and list on the right" },
      dial: { name: "Dual dial", hint: "Large countdown and stopwatch dials with lap splits" },
      grid: { name: "Preset grid", hint: "One-click preset tiles that fill with live progress" },
      hub: { name: "Time hub", hint: "Timers alongside live break reminder progress" },
    },
  },
  panel: {
    presetTags: { 1: "Quick", 3: "Tea", 5: "Break", 10: "Rest", 15: "Sync", 25: "Focus" },
    minuteShort: (minutes) => `${minutes}m`,
    hourShort: (hours) => `${hours}h`,
    minutesFull: (minutes) => `${minutes} min`,
    addOneMin: "+1m",
    addFiveMin: "+5m",
    stepMinusOne: "-1m",
    stepPlusOne: "+1m",
    stepPlusFive: "+5m",
    etaAt: (time) => `Ends at ${time}`,
    etaShort: (time) => `At ${time}`,
    previewLabel: "Preview",
    quickSetLabel: "Quick set",
    pressEnterStart: "Press Enter to start",
    pickPresetOrAdjust: "Pick a preset or nudge the length",
    startWithLength: (clock) => `Start ${clock}`,
    remainingLabel: "Left",
    elapsedLabel: "Elapsed",
    pausedLabel: "Paused",
    runningLabel: "Running",
    stopwatchRunning: "Counting up",
    stopwatchPaused: "Stopwatch paused",
    newStopwatch: "New stopwatch",
    activeCount: (count, max) => `Active · ${count} / ${max}`,
    hasDue: "A timer is up",
    sortedHint: "Sorted by status",
    soundOn: "Timer sound: on",
    soundOff: "Timer sound: off",
    hoursUnit: "hr",
    minutesUnit: "min",
    secondsUnit: "sec",
    increaseUnit: (unit) => `Increase ${unit}`,
    decreaseUnit: (unit) => `Decrease ${unit}`,
    allCountdowns: (count) => `Countdowns (${count})`,
    lap: "Lap",
    lapsTitle: "Lap splits",
    lapsCount: (count) => `${count}`,
    lapsEmpty: "Tap Lap while running to record splits",
    resetStopwatch: "Reset stopwatch",
    tapToStart: "Click to start",
    ringingHint: "Extend or dismiss",
    hubTitle: "Start a countdown anytime",
    hubSub: "Type a length and press Enter, or tap a preset",
    focusPreset: "25m focus",
    recentLabel: "Recent",
    breakRemaining: (minutes) => `in ${minutes}m`,
    breakReset: "Reset this break reminder",
    breakFooterOn: "Pauses after 5 min away",
    breakFooterOff: "Off · Turn on for sit and eye break alerts",
    breakEmpty: "No enabled reminders",
    layoutButton: (name) => `Timer layout: ${name}`,
  },
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
  settings: {
    title: "Timer",
    sound: "Play a sound when time is up",
    soundHint: "When a countdown ends, a sound plays as well as the reminder on the island",
    shortcut: "Open the timer",
    shortcutHint: "Pressed anywhere, it expands the island on the Timer page with the cursor in the length box.",
    shortcutOff: "Not set",
    setShortcut: "Set shortcut",
    turnOffShortcut: "Turn off the shortcut",
    shortcutProblem: { invalid: "This shortcut cannot be used; pick one with a modifier key.", taken: "Another app is using this shortcut; pick another." },
    shortcutInvalidMac: "This shortcut cannot be used on a Mac; pick one with Control, Option or Command.",
  },
};
