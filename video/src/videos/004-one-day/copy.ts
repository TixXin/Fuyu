import type { Lang } from "../types";

const zh = {
  title: "浮屿的一天",
  subtitle: "一座岛，从早到晚",
  labels: { morning: "待办", meeting: "日历", noon: "消息", afternoon: "AI Agent", copy: "剪贴板", translate: "翻译", night: "音乐" },
  end: {
    name: "浮屿", latin: "Fuyu", tagline: "Windows 上的桌面灵动岛",
    facts: ["开源", "免费", "插件市场"], url: "官网:https://fuyu.ing",
  },
  todos: ["写完发布说明", "回复 issue #44", "给插件市场加搜索", "订周五的会议室"],
  events: [
    { title: "产品周会", location: "线上会议", calendar: "工作" },
    { title: "设计评审", location: "302 会议室", calendar: "工作" },
    { title: "健身", location: "", calendar: "个人" },
  ],
  approvalNote: "运行剪贴板的回归测试",
};

const en: typeof zh = {
  title: "A day with Fuyu",
  subtitle: "One island, morning to night",
  labels: { morning: "Todos", meeting: "Calendar", noon: "Messages", afternoon: "AI agents", copy: "Clipboard", translate: "Translate", night: "Music" },
  end: {
    name: "浮屿", latin: "Fuyu", tagline: "A dynamic island for the Windows desktop",
    facts: ["Open source", "Free", "Plugin market"], url: "Website: https://fuyu.ing",
  },
  todos: ["Finish the release notes", "Reply to issue #44", "Add search to the plugin market", "Book a room for Friday"],
  events: [
    { title: "Product weekly", location: "Online", calendar: "Work" },
    { title: "Design review", location: "Room 302", calendar: "Work" },
    { title: "Gym", location: "", calendar: "Personal" },
  ],
  approvalNote: "Run the clipboard regression tests",
};

export type Copy = typeof zh;

export function copyFor(lang: Lang): Copy {
  return lang === "en" ? en : zh;
}
