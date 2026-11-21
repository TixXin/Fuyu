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
  cities: { tokyo: string; london: string; newYork: string };
  countdownTo: { lunarNewYear: string; newYear: string };
  days: string;
  addCup: string;
  removeCup: string;
  cups: (count: number, goal: number) => string;
  habitNames: [string, string, string];
  thisWeek: string;
  toggleHabit: (habit: string, day: string) => string;
  notePlaceholder: string;
  sunrise: string;
  sunset: string;
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
  cities: { tokyo: "东京", london: "伦敦", newYork: "纽约" },
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
  cities: { tokyo: "Tokyo", london: "London", newYork: "New York" },
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
};
