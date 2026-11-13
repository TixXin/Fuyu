import type { Lang } from "../types";

const zh = {
  title: "消息，都在一座岛上",
  end: {
    name: "浮屿", latin: "Fuyu", tagline: "Windows 上的桌面灵动岛",
    facts: ["开源", "免费", "QQ · 微信 · 邮件"], url: "官网:https://fuyu.ing",
  },
  todos: ["写完发布说明", "回复 issue #44", "给插件市场加搜索"],
  qq: { title: "小林", body: "下午三点的评审，会议室改到 302 了" },
  wechat: { chat: "产品群", contact: "阿远", preview: "新版设计稿发群里了，有空看看" },
  mail: {
    sender: "项目组", subject: "本周进度已更新",
    body: "各位好：\n\n本周进度已经更新，要点如下。\n\n1. 剪贴板搜索已合入，周四随测试版发出。\n2. 插件市场的搜索进入评审，周五前给出结论。\n3. 下周一上午十点例会，改在 302 会议室。\n\n有问题直接回复这封邮件。\n\n项目组",
  },
  editorTitle: "fuyu - 编辑器",
  editorStatus: "main   UTF-8   TypeScript",
  browser: {
    tabs: ["插件开发 · 浮屿文档", "新标签页"], url: "fuyu.ing/docs/plugins/quick-start",
    nav: ["概览", "快速开始", "清单", "岛上界面", "发布"],
    heading: "快速开始",
    paragraphs: ["用脚手架新建一个插件，几分钟就能在岛上看到自己的页面。", "插件是一个独立的进程，通过 JSON-RPC 和岛屿通信，可以用 Node 或 PowerShell 来写。"],
  },
};

const en: typeof zh = {
  title: "Every message, on one island",
  end: {
    name: "浮屿", latin: "Fuyu", tagline: "A dynamic island for the Windows desktop",
    facts: ["Open source", "Free", "QQ · WeChat · Mail"], url: "Website: https://fuyu.ing",
  },
  todos: ["Finish the release notes", "Reply to issue #44", "Add search to the plugin market"],
  qq: { title: "Lin", body: "The 3 pm review moved to room 302" },
  wechat: { chat: "Product", contact: "Yuan", preview: "New mockups are in the group, take a look" },
  mail: {
    sender: "Team", subject: "Weekly progress updated",
    body: "Hi all,\n\nThis week's progress is in. The highlights:\n\n1. Clipboard search has landed and ships with Thursday's beta.\n2. Plugin market search is in review, with a decision by Friday.\n3. Monday's 10 am sync moves to room 302.\n\nReply to this mail if anything is unclear.\n\nThe team",
  },
  editorTitle: "fuyu - Editor",
  editorStatus: "main   UTF-8   TypeScript",
  browser: {
    tabs: ["Plugin guide · Fuyu docs", "New tab"], url: "fuyu.ing/docs/plugins/quick-start",
    nav: ["Overview", "Quick start", "Manifest", "Island UI", "Publishing"],
    heading: "Quick start",
    paragraphs: ["Scaffold a plugin and see your own page on the island within minutes.", "A plugin is a separate process that talks to the island over JSON-RPC. Write it in Node or PowerShell."],
  },
};

export type Copy = typeof zh;

export function copyFor(lang: Lang): Copy {
  return lang === "en" ? en : zh;
}
