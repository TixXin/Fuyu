export type SettingsAgentNoticeText = {
  lookTitle: string;
  behaviorTitle: string;
  approvalTitle: string;
  reset: string;
  defaultMark: (label: string) => string;
  style: string;
  styleHint: string;
  styleOptions: Record<"status" | "compact" | "wings", string>;
  notch: string;
  notchHint: string;
  notchOptions: Record<"band" | "below", string>;
  messageLines: string;
  messageLinesHint: string;
  linesValue: (lines: number) => string;
  linesAuto: string;
  commandLines: string;
  markdown: string;
  markdownHint: string;
  meta: string;
  metaOptions: Record<"hover" | "inline", string>;
  scrollbar: string;
  scrollbarOptions: Record<"auto" | "always", string>;
  started: string;
  startedOptions: Record<"everyTurn" | "newSession" | "off" | "hidden", string>;
  yourTurn: string;
  yourTurnHint: string;
  failed: string;
  untilSeen: string;
  closeAfter: (seconds: number) => string;
  completed: string;
  completedHint: string;
  hoverHold: string;
  click: string;
  clickHint: string;
  clickOptions: Record<"window" | "page", string>;
  stack: string;
  stackHint: string;
  stackOptions: Record<"peek" | "count" | "wings", string>;
  buttonOrder: string;
  buttonOrderOptions: Record<"allowRight" | "allowLeft", string>;
  shortcuts: string;
  shortcutsHint: string;
  footer: string;
};

export const zhCN: SettingsAgentNoticeText = {
  lookTitle: "通知的样子",
  behaviorTitle: "通知的行为",
  approvalTitle: "审批按钮",
  reset: "恢复默认",
  defaultMark: (label) => `${label}（默认）`,
  style: "通知样式",
  styleHint: "三套样式任选",
  styleOptions: { status: "状态优先", compact: "精简两行", wings: "两翼 + 下拉" },
  notch: "Mac 刘海时",
  notchHint: "只在 Mac 有刘海时起作用",
  notchOptions: { band: "刘海两边放标题带", below: "整条放在刘海下面" },
  messageLines: "消息正文最多显示",
  messageLinesHint: "超出在卡片里滚动；「随内容长高」到岛的最大高度为止",
  linesValue: (lines) => `${lines} 行`,
  linesAuto: "随内容长高",
  commandLines: "运行中的命令最多显示",
  markdown: "消息按 Markdown 显示",
  markdownHint: "列表、代码块和行内代码；关掉显示纯文字",
  meta: "模型、用时、「你：」",
  metaOptions: { hover: "只在悬停卡片里", inline: "通知里也显示" },
  scrollbar: "滚动条",
  scrollbarOptions: { auto: "滚动时出现", always: "一直显示" },
  started: "开始新一轮时",
  startedOptions: { everyTurn: "每一轮都弹出", newSession: "只在新会话弹出", off: "只在收起条显示标题", hidden: "不显示" },
  yourTurn: "等你回复的通知",
  yourTurnHint: "看过 = 悬停过它，或切到了那个窗口",
  failed: "出错的通知",
  untilSeen: "留到看过",
  closeAfter: (seconds) => `${seconds} 秒后收起`,
  completed: "完成的通知停留",
  completedHint: "等你确认的通知始终留到你处理",
  hoverHold: "鼠标停在岛上时暂停倒计时",
  click: "点通知",
  clickHint: "另一个去处放在右上角的小按钮",
  clickOptions: { window: "切到会话所在的窗口", page: "打开 Agent 页" },
  stack: "多个会话同时来",
  stackHint: "悬停都能展开成列表",
  stackOptions: { peek: "叠放，露出后面的边", count: "一次一条，右上角 +n", wings: "左翼图标堆" },
  buttonOrder: "按钮顺序",
  buttonOrderOptions: { allowRight: "拒绝 · 到终端 · 允许", allowLeft: "允许 · 到终端 · 拒绝" },
  shortcuts: "按钮上显示快捷键",
  shortcutsHint: "窄岛上会自动隐藏",
  footer: "「恢复默认」把这三组改回出厂值；上面的提醒开关不变。",
};

export const en: SettingsAgentNoticeText = {
  lookTitle: "Notice look",
  behaviorTitle: "Notice behavior",
  approvalTitle: "Approval buttons",
  reset: "Reset to default",
  defaultMark: (label) => `${label} (default)`,
  style: "Notice style",
  styleHint: "Pick any of the three",
  styleOptions: { status: "Status first", compact: "Compact, two lines", wings: "Wings + drop-down" },
  notch: "With a Mac notch",
  notchHint: "Title band on both sides of the notch, or the whole notice below it; Mac with a notch only",
  notchOptions: { band: "Beside the notch", below: "Below the notch" },
  messageLines: "Message shows up to",
  messageLinesHint: "Longer messages scroll inside the card; \"Fit content\" grows up to the island's maximum height",
  linesValue: (lines) => (lines === 1 ? "1 line" : `${lines} lines`),
  linesAuto: "Fit content",
  commandLines: "Running command shows up to",
  markdown: "Show messages as Markdown",
  markdownHint: "Lists, code blocks and inline code; off shows plain text",
  meta: "Model, time and \"You:\"",
  metaOptions: { hover: "Hover card only", inline: "In the notice too" },
  scrollbar: "Scroll bar",
  scrollbarOptions: { auto: "While scrolling", always: "Always" },
  started: "When a new turn starts",
  startedOptions: { everyTurn: "Pop up every turn", newSession: "Pop up for new sessions", off: "Collapsed bar title", hidden: "Show nothing" },
  yourTurn: "Your-turn notices",
  yourTurnHint: "Seen means you hovered it or switched to that window",
  failed: "Failure notices",
  untilSeen: "Stay until seen",
  closeAfter: (seconds) => `Close after ${seconds} s`,
  completed: "Finished notices stay",
  completedHint: "Approval requests always stay until you handle them",
  hoverHold: "Pause the countdown while the pointer is on the island",
  click: "Clicking a notice",
  clickHint: "Switch to the session's window or open the Agent page; the other one is the small button at the top right",
  clickOptions: { window: "Session window", page: "Agent page" },
  stack: "Several sessions at once",
  stackHint: "Stacked shows the edges of the ones behind; hovering always expands them into a list",
  stackOptions: { peek: "Stacked", count: "One at a time, +n", wings: "Icon pile in the wing" },
  buttonOrder: "Button order",
  buttonOrderOptions: { allowRight: "Deny · Terminal · Allow", allowLeft: "Allow · Terminal · Deny" },
  shortcuts: "Show shortcuts on buttons",
  shortcutsHint: "Hidden automatically on a narrow island",
  footer: "Reset to default restores these three groups; the alert switches above stay as they are.",
};
