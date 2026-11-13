import type { Lang } from "../types";

const zh = {
  title: "别再盯着终端",
  hook: "Claude Code 在等你确认，你却在看别的窗口",
  watch: ["浮屿", "AI 在干什么，岛上一直看得到"],
  approve: ["审批", "要你确认时，它自己弹出来"],
  sessions: ["会话", "谁在跑、谁做完了、额度还剩多少"],
  jump: ["跳转", "点一下，回到它的终端"],
  end: {
    name: "浮屿", latin: "Fuyu", tagline: "Claude Code 和 Codex 的状态，都在岛上",
    facts: ["开源", "免费", "Windows"], url: "官网:https://fuyu.ing",
  },
  terminal: ["终端 · claude", "> 给剪贴板加搜索", "● 已修改 clipboard/search.ts", "● 想运行：pnpm test:regression clipboard", "  允许吗？ (y/n) ▌"],
  terminalAfter: ["终端 · claude", "> 给剪贴板加搜索", "● 已修改 clipboard/search.ts", "● Bash  pnpm test:regression clipboard", "  ✓ 全部检查通过", "● 正在补回归页的用例 ▌"],
  docs: ["文档", "快速开始 · 安装与第一次启动", "插件清单 · manifest 字段", "岛上界面 · 列表与表单模板", "发布 · 提交到插件市场"],
  sessionTitles: ["给剪贴板加搜索", "整理发布说明", "修复歌词偏移"],
  sessionMessages: ["正在修改 clipboard/search.ts，接着补回归页的用例。", "发布说明已按功能分好组。", "偏移量按歌保存，测试通过。"],
  approvalNote: "运行剪贴板的回归测试",
};

const en: typeof zh = {
  title: "Stop watching the terminal",
  hook: "Claude Code is waiting for you, and you're in another window",
  watch: ["Fuyu", "What your agents are doing, always in view"],
  approve: ["Approvals", "When it needs you, it pops up by itself"],
  sessions: ["Sessions", "Who is running, who is done, how much quota is left"],
  jump: ["Jump", "One click takes you back to its terminal"],
  end: {
    name: "浮屿", latin: "Fuyu", tagline: "Claude Code and Codex status, on one island",
    facts: ["Open source", "Free", "Windows"], url: "Website: https://fuyu.ing",
  },
  terminal: ["Terminal · claude", "> Add search to the clipboard", "● Edited clipboard/search.ts", "● Wants to run: pnpm test:regression clipboard", "  Allow? (y/n) ▌"],
  terminalAfter: ["Terminal · claude", "> Add search to the clipboard", "● Edited clipboard/search.ts", "● Bash  pnpm test:regression clipboard", "  ✓ All checks passed", "● Adding regression cases ▌"],
  docs: ["Docs", "Quick start · Install and first launch", "Manifest · Fields", "Island UI · List and form templates", "Publishing · Submit to the market"],
  sessionTitles: ["Add search to the clipboard", "Tidy the release notes", "Fix the lyrics offset"],
  sessionMessages: ["Editing clipboard/search.ts, then adding regression cases.", "Release notes are grouped by feature.", "Offsets are saved per song; tests pass."],
  approvalNote: "Run the clipboard regression tests",
};

export type Copy = typeof zh;

export function copyFor(lang: Lang): Copy {
  return lang === "en" ? en : zh;
}
