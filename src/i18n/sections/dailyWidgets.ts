import type { CityId } from "../../features/daily-widgets/cities.ts";

export type DailyWidgetsText = {
  names: {
    today: string;
    pomodoro: string;
    streak: string;
    focus: string;
    year: string;
    worldClock: string;
    countdown: string;
    water: string;
    habits: string;
    note: string;
    sun: string;
  };
  greetings: { night: string; morning: string; noon: string; afternoon: string; evening: string };
  todaySummary: (focus: string, cups: number) => string;
  streakDays: (days: number) => string;
  checkIn: string;
  focusToday: string;
  start: string;
  pause: string;
  reset: string;
  cities: Record<CityId, string>;
  countdownTo: { lunarNewYear: string; newYear: string };
  days: string;
  addCup: string;
  removeCup: string;
  cups: (count: number, goal: number) => string;
  habitNames: string[];
  thisWeek: string;
  toggleHabit: (habit: string, day: string) => string;
  notePlaceholder: string;
  sunrise: string;
  sunset: string;
  edit: string;
  done: string;
  remove: string;
  addHabit: string;
  habitPlaceholder: string;
  habitFallback: (index: number) => string;
  addCountdown: string;
  countdownName: string;
  countdownNamePlaceholder: string;
  countdownDate: string;
  countdownDateHint: string;
  countdownUntitled: string;
  nextCountdown: string;
  daysAgo: string;
  isToday: string;
  everyYear: string;
  changeCity: (city: string) => string;
  chooseCity: string;
  followSystem: string;
  sunGuess: string;
  waterGoal: (goal: number) => string;
  pomodoroLength: (minutes: number) => string;
  pomodoroDone: (minutes: number) => string;
  pomodoroAgain: string;
  dismiss: string;
  daysLeft: (days: number) => string;
};

export const zhCN: DailyWidgetsText = {
  names: {
    today: "今日",
    pomodoro: "番茄钟",
    streak: "打卡",
    focus: "专注统计",
    year: "年进度",
    worldClock: "世界时钟",
    countdown: "倒数日",
    water: "喝水",
    habits: "习惯",
    note: "便签",
    sun: "日出日落",
  },
  greetings: { night: "夜深啦，早点休息", morning: "早上好，今天也顺利", noon: "记得吃午饭", afternoon: "下午也要专注", evening: "辛苦了，放松一下" },
  todaySummary: (focus, cups) => `已专注 ${focus} · 喝了 ${cups} 杯水`,
  streakDays: (days) => `${days} 天`,
  checkIn: "今天打卡",
  focusToday: "今日专注",
  start: "开始",
  pause: "暂停",
  reset: "重来",
  cities: {
    beijing: "北京",
    shanghai: "上海",
    guangzhou: "广州",
    shenzhen: "深圳",
    hangzhou: "杭州",
    nanjing: "南京",
    wuhan: "武汉",
    chengdu: "成都",
    chongqing: "重庆",
    xian: "西安",
    harbin: "哈尔滨",
    kunming: "昆明",
    urumqi: "乌鲁木齐",
    hongKong: "香港",
    taipei: "台北",
    tokyo: "东京",
    seoul: "首尔",
    singapore: "新加坡",
    bangkok: "曼谷",
    delhi: "新德里",
    dubai: "迪拜",
    moscow: "莫斯科",
    istanbul: "伊斯坦布尔",
    berlin: "柏林",
    paris: "巴黎",
    london: "伦敦",
    newYork: "纽约",
    toronto: "多伦多",
    chicago: "芝加哥",
    losAngeles: "洛杉矶",
    vancouver: "温哥华",
    saoPaulo: "圣保罗",
    sydney: "悉尼",
    melbourne: "墨尔本",
    auckland: "奥克兰",
  },
  countdownTo: { lunarNewYear: "距离春节", newYear: "距离元旦" },
  days: "天",
  addCup: "喝了一杯",
  removeCup: "撤销一杯",
  cups: (count, goal) => `${count}/${goal}`,
  habitNames: ["阅读", "运动", "早睡"],
  thisWeek: "本周",
  toggleHabit: (habit, day) => `${day} ${habit}`,
  notePlaceholder: "点这里，记下此刻想到的…",
  sunrise: "日出",
  sunset: "日落",
  edit: "编辑",
  done: "完成",
  remove: "删除",
  addHabit: "添加习惯",
  habitPlaceholder: "习惯名称",
  habitFallback: (index) => `习惯 ${index}`,
  addCountdown: "再加一个",
  countdownName: "名称",
  countdownNamePlaceholder: "生日、纪念日…",
  countdownDate: "日期",
  countdownDateHint: "写 12-25 即每年",
  countdownUntitled: "倒数日",
  nextCountdown: "下一个",
  daysAgo: "天前",
  isToday: "就是今天",
  everyYear: "每年",
  changeCity: (city) => `换掉${city}`,
  chooseCity: "选择城市",
  followSystem: "跟随系统时区",
  sunGuess: "估算",
  waterGoal: (goal) => `每天 ${goal} 杯，点一下换目标`,
  pomodoroLength: (minutes) => `一轮 ${minutes} 分钟，点一下换时长`,
  pomodoroDone: (minutes) => `番茄钟结束，专注了 ${minutes} 分钟`,
  pomodoroAgain: "再来一轮",
  dismiss: "知道了",
  daysLeft: (days) => `还剩 ${days} 天`,
};

export const en: DailyWidgetsText = {
  names: {
    today: "Today",
    pomodoro: "Pomodoro",
    streak: "Check-in",
    focus: "Focus stats",
    year: "Year progress",
    worldClock: "World clock",
    countdown: "Countdown",
    water: "Water",
    habits: "Habits",
    note: "Note",
    sun: "Sunrise & sunset",
  },
  greetings: { night: "It's late, get some rest", morning: "Good morning, have a nice day", noon: "Don't forget lunch", afternoon: "Stay focused this afternoon", evening: "Well done, time to relax" },
  todaySummary: (focus, cups) => `Focused ${focus} · ${cups} ${cups === 1 ? "cup" : "cups"} of water`,
  streakDays: (days) => `${days} ${days === 1 ? "day" : "days"}`,
  checkIn: "Check in today",
  focusToday: "Focus today",
  start: "Start",
  pause: "Pause",
  reset: "Reset",
  cities: {
    beijing: "Beijing",
    shanghai: "Shanghai",
    guangzhou: "Guangzhou",
    shenzhen: "Shenzhen",
    hangzhou: "Hangzhou",
    nanjing: "Nanjing",
    wuhan: "Wuhan",
    chengdu: "Chengdu",
    chongqing: "Chongqing",
    xian: "Xi'an",
    harbin: "Harbin",
    kunming: "Kunming",
    urumqi: "Urumqi",
    hongKong: "Hong Kong",
    taipei: "Taipei",
    tokyo: "Tokyo",
    seoul: "Seoul",
    singapore: "Singapore",
    bangkok: "Bangkok",
    delhi: "New Delhi",
    dubai: "Dubai",
    moscow: "Moscow",
    istanbul: "Istanbul",
    berlin: "Berlin",
    paris: "Paris",
    london: "London",
    newYork: "New York",
    toronto: "Toronto",
    chicago: "Chicago",
    losAngeles: "Los Angeles",
    vancouver: "Vancouver",
    saoPaulo: "São Paulo",
    sydney: "Sydney",
    melbourne: "Melbourne",
    auckland: "Auckland",
  },
  countdownTo: { lunarNewYear: "Lunar New Year", newYear: "New Year" },
  days: "days",
  addCup: "Drank a cup",
  removeCup: "Undo a cup",
  cups: (count, goal) => `${count}/${goal}`,
  habitNames: ["Read", "Move", "Sleep"],
  thisWeek: "This week",
  toggleHabit: (habit, day) => `${habit} on ${day}`,
  notePlaceholder: "Jot down what's on your mind…",
  sunrise: "Sunrise",
  sunset: "Sunset",
  edit: "Edit",
  done: "Done",
  remove: "Delete",
  addHabit: "Add habit",
  habitPlaceholder: "Habit name",
  habitFallback: (index) => `Habit ${index}`,
  addCountdown: "Add another",
  countdownName: "Name",
  countdownNamePlaceholder: "Birthday, trip…",
  countdownDate: "Date",
  countdownDateHint: "12-25 = every year",
  countdownUntitled: "Countdown",
  nextCountdown: "Next",
  daysAgo: "days ago",
  isToday: "It's today",
  everyYear: "yearly",
  changeCity: (city) => `Change ${city}`,
  chooseCity: "Choose a city",
  followSystem: "Follow system time zone",
  sunGuess: "Approx.",
  waterGoal: (goal) => `${goal} cups a day, click to change`,
  pomodoroLength: (minutes) => `${minutes} min per round, click to change`,
  pomodoroDone: (minutes) => `Pomodoro done, ${minutes} min focused`,
  pomodoroAgain: "One more round",
  dismiss: "Got it",
  daysLeft: (days) => `${days}d left`,
};
