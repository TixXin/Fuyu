import type { Lang } from "../types";

const zh = {
  title: "一座岛，收下桌面的零碎",
  hook: "看一眼消息，要切几次窗口？",
  reveal: ["浮屿", "把它们都收到一座岛上"],
  todo: ["待办", "今天要做的，抬头就在"],
  music: ["音乐", "歌词跟着唱"],
  messages: ["消息", "QQ、微信、邮件，一眼看完"],
  clipboard: ["剪贴板", "复制过的，都还在"],
  translation: ["翻译", "一个快捷键，原文译文并排"],
  agents: ["AI Agent", "Claude Code 跑到哪了，岛上点一下就批准"],
  tuck: ["", "用完，它自己收回去"],
  end: {
    name: "浮屿", latin: "Fuyu", tagline: "Windows 上的桌面灵动岛",
    facts: ["开源", "免费", "插件市场"], url: "官网:https://fuyu.ing",
  },
  windows: {
    chat: ["聊天", "小林：下午三点评审，改到 302", "产品群：新版设计稿发了", "阿远：晚上打球吗"],
    mail: ["邮箱", "项目组 · 本周进度已更新", "设计评审 · 会议纪要", "账单 · 11 月云服务"],
    music: ["音乐", "一座岛", "浮屿乐队"],
    terminal: ["终端", "> claude", "● 正在修改 clipboard/search.ts", "● 需要你的确认：运行 pnpm test ?", "  (y/n)"],
    notes: ["待办清单", "写完发布说明", "回复 issue #44", "给插件市场加搜索", "买咖啡豆"],
    translate: ["翻译", "The island stays out of your way…", "这座岛平时不打扰你……"],
    clipboard: ["剪贴板历史", "pnpm build:exe", "https://fuyu.ing", "#74d6ff"],
  },
  todos: ["写完发布说明", "回复 issue #44", "给插件市场加搜索", "买咖啡豆"],
  song: { title: "一座岛", artist: "浮屿乐队", album: "潮汐", player: "本地音乐" },
  lyrics: ["潮水退到屏幕的边上", "我把今天放在一座岛上", "风来的时候 它轻轻展开", "风走的时候 它自己回航", "抬头就看见 不用再张望"],
  qq: { title: "小林", body: "下午三点的评审，会议室改到 302 了" },
  wechat: { chat: "产品群", contact: "阿远", preview: "新版设计稿发群里了，有空看看" },
  mail: { sender: "项目组", subject: "本周进度已更新，请查收" },
  clips: ["pnpm build:exe", "https://fuyu.ing", "下午三点的评审，会议室改到 302 了", "#74d6ff"],
  clipSources: ["终端", "浏览器", "聊天", "设计工具"],
  translate: {
    source: "The island stays out of your way until you need it.",
    result: "这座岛平时不打扰你，需要时才出现。",
  },
  sessions: ["给剪贴板加搜索", "整理发布说明", "修复歌词偏移"],
  sessionMessages: ["正在修改 clipboard/search.ts，接着补回归页的用例。", "发布说明已按功能分好组。", "偏移量按歌保存，测试通过。"],
};

const en: typeof zh = {
  title: "One island for your desktop",
  hook: "How many windows for one quick glance?",
  reveal: ["Fuyu", "puts them all on one island"],
  todo: ["Todos", "Today's list, right where you look"],
  music: ["Music", "Lyrics that follow the song"],
  messages: ["Messages", "QQ, WeChat and mail at a glance"],
  clipboard: ["Clipboard", "Everything you copied is still here"],
  translation: ["Translate", "One shortcut, source and result side by side"],
  agents: ["AI agents", "See where Claude Code is, approve from the island"],
  tuck: ["", "Done? It tucks itself away"],
  end: {
    name: "浮屿", latin: "Fuyu", tagline: "A dynamic island for the Windows desktop",
    facts: ["Open source", "Free", "Plugin market"], url: "Website: https://fuyu.ing",
  },
  windows: {
    chat: ["Chat", "Lin: review moved to room 302 at 3", "Product: new mockups are up", "Yuan: basketball tonight?"],
    mail: ["Mail", "Team · Weekly progress updated", "Design review · Meeting notes", "Billing · November cloud"],
    music: ["Music", "One Island", "Fuyu Band"],
    terminal: ["Terminal", "> claude", "● Editing clipboard/search.ts", "● Needs your approval: run pnpm test ?", "  (y/n)"],
    notes: ["Todo list", "Finish the release notes", "Reply to issue #44", "Add search to the plugin market", "Buy coffee beans"],
    translate: ["Translate", "这座岛平时不打扰你……", "The island stays out of your way…"],
    clipboard: ["Clipboard history", "pnpm build:exe", "https://fuyu.ing", "#74d6ff"],
  },
  todos: ["Finish the release notes", "Reply to issue #44", "Add search to the plugin market", "Buy coffee beans"],
  song: { title: "One Island", artist: "Fuyu Band", album: "Tides", player: "Local music" },
  lyrics: ["The tide pulls back to the edge of the screen", "I leave today on a single island", "When the wind comes it gently opens", "When the wind goes it sails back home", "Look up and it's there, no need to search"],
  qq: { title: "Lin", body: "The 3 pm review moved to room 302" },
  wechat: { chat: "Product", contact: "Yuan", preview: "New mockups are in the group, take a look" },
  mail: { sender: "Team", subject: "Weekly progress updated" },
  clips: ["pnpm build:exe", "https://fuyu.ing", "The 3 pm review moved to room 302", "#74d6ff"],
  clipSources: ["Terminal", "Browser", "Chat", "Design tool"],
  translate: {
    source: "这座岛平时不打扰你，需要时才出现。",
    result: "The island stays out of your way until you need it.",
  },
  sessions: ["Add search to the clipboard", "Tidy the release notes", "Fix the lyrics offset"],
  sessionMessages: ["Editing clipboard/search.ts, then adding regression cases.", "Release notes are grouped by feature.", "Offsets are saved per song; tests pass."],
};

export type Copy = typeof zh;

export function copyFor(lang: Lang): Copy {
  return lang === "en" ? en : zh;
}
