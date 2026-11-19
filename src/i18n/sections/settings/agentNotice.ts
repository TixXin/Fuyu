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
  eventsTitle: string;
  eventsFooter: string;
  stayHandled: string;
  audition: (sound: string) => string;
  preview: {
    label: string;
    events: Record<"approval" | "question" | "yourTurn" | "done" | "failed" | "started" | "stack", string>;
    play: string;
    stop: string;
    tryOnIsland: string;
    tryHint: string;
    tryOff: string;
    tryResult: Record<"shown" | "shownCard" | "busy" | "expanded" | "muted" | "noReply", string>;
    shrunk: (percent: number) => string;
    hidden: Record<"waiting" | "completed" | "failed" | "title" | "none", string>;
    stay: (stay: string) => string;
    hoverHold: string;
    remind: (after: string) => string;
    clickNote: Record<"window" | "page", string>;
    sound: (name: string) => string;
    steps: {
      collapsed: string;
      handled: string;
      remindSoon: (after: string) => string;
      reminded: string;
      looked: string;
      seconds: (seconds: number, shown: number) => string;
      hold: string;
      leaving: string;
      ended: string;
    };
    collapsed: string;
    running: string;
    sample: {
      prompt: string;
      approvalTitle: string;
      questionTitle: string;
      questionHeader: string;
      question: string;
      questionOptions: readonly [string, string, string];
      yourTurnTitle: string;
      yourTurnMessage: string;
      doneTitle: string;
      doneMessage: string;
      failedTitle: string;
      failedMessage: string;
      startedTitle: string;
    };
  };
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
  footer: "「恢复默认」把这三组、各事件的停留和「开始新一轮时」改回出厂值；弹出开关和「没处理时再提醒」不变。",
  eventsTitle: "什么时候提醒",
  eventsFooter: "点一行，上面的预览换成这种提醒。",
  stayHandled: "留到你处理",
  audition: (sound) => `试听：${sound}`,
  preview: {
    label: "通知预览",
    events: { approval: "等你确认", question: "提问", yourTurn: "等你回复", done: "完成", failed: "出错", started: "开始新一轮", stack: "多个会话" },
    play: "播放",
    stop: "停止",
    tryOnIsland: "在岛上试一下",
    tryHint: "让岛按现在的设置弹一条测试通知并响一声，不会回复任何 Agent",
    tryOff: "这种通知现在不弹出，打开对应的开关后再试",
    tryResult: {
      shown: "测试通知已弹到岛上：不进会话列表，不推送到手机",
      shownCard: "测试通知已弹到岛上：点岛上任意按钮收起，不会回复任何 Agent，不点 30 秒后自己收起",
      busy: "岛上正有真的提醒，等它收起后再试",
      expanded: "岛展开着，收起后再试",
      muted: "岛现在不弹 Agent 提醒：游戏模式勿扰中，或 Agent 功能已关",
      noReply: "岛没有回应，确认岛在运行后再试",
    },
    shrunk: (percent) => `缩小到 ${percent}%`,
    hidden: {
      waiting: "「等待你确认或回答时」已关，这种情况不弹出",
      completed: "「会话完成时」已关，这种情况不弹出",
      failed: "「会话出错时」已关，这种情况不弹出",
      title: "开始新一轮不弹出，只在收起条显示标题",
      none: "开始新一轮什么都不显示",
    },
    stay: (stay) => `停留：${stay}`,
    hoverHold: "鼠标停在岛上暂停",
    remind: (after) => `${after}再提醒一次`,
    clickNote: { window: "点通知切到会话窗口，右上角打开 Agent 页", page: "点通知打开 Agent 页，右上角切到会话窗口" },
    sound: (name) => `声音：${name}`,
    steps: {
      collapsed: "收起的岛",
      handled: "留到你处理：点卡片上的一个按钮",
      remindSoon: (after) => `${after}还没处理会再弹一次，这里缩成 3 秒`,
      reminded: "没处理，再提醒一次并再响一次；每次等待只补一次",
      looked: "留到看过：把鼠标移到卡片上再移开",
      seconds: (seconds, shown) => (shown < seconds ? `${seconds} 秒后收起，这里按 ${shown} 秒播` : `${seconds} 秒后收起`),
      hold: "把鼠标放上去，倒计时会停",
      leaving: "收起",
      ended: "演示到这里结束，真的会一直留着",
    },
    collapsed: "14:32 · 3 项待办",
    running: "运行中",
    sample: {
      prompt: "继续，做完跑一遍回归",
      approvalTitle: "修复剪贴板图片粘贴失败",
      questionTitle: "提醒设置页重做",
      questionHeader: "预览",
      question: "预览台放在哪里？",
      questionOptions: ["页面顶部，滚动时缩小", "右侧单独一栏", "不放预览"],
      yourTurnTitle: "Mac 刘海形态的弹出卡片",
      yourTurnMessage: "两种做法，选一个：\n1. **刘海两边放图标和状态**，正文从刘海下面开始\n2. **整条往下弹**，两翼空着\n\n我倾向 **1**：两翼本来就空着，而且和消息提醒一致。要改 `IslandShell.tsx` 和 `AgentAlert.css`，大约 80 行。\n\n你选哪种？",
      doneTitle: "Agent 通知：消息尽量显示全",
      doneMessage: "这一轮做完了，改了 6 个文件：\n1. `AgentSessionRow.tsx`：标题行去掉模型胶囊，挪进悬停卡\n2. `SessionBody.tsx`：最后一条消息按 Markdown 显示\n3. `AgentAlert.css`：消息最多 6 行，超出在卡片里滚动\n4. `useIslandAgentAlerts.ts`：悬停时停住倒计时\n5. 两个回归页的快照\n\n验证：\n```\npnpm check            ✓\npnpm test:regression  ✓ 14 页\n```\n**还没做**：Mac 刘海形态的标题带，等你定方向。\n\n没有提交。",
      failedTitle: "发布 0.3.11 候选版",
      failedMessage: "`pnpm release` 在上传前失败：\n```\nError: TAURI_SIGNING_PRIVATE_KEY is empty\n```\n安装包已经打好，**没有上传**，`latest.json` 也没改。",
      startedTitle: "提醒设置页重做：出预览页",
    },
  },
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
  footer: "Reset to default restores these three groups, how long each event stays and \"When a new turn starts\"; the pop-up switches and \"Remind again\" stay as they are.",
  eventsTitle: "When to notify",
  eventsFooter: "Click a row to see that notice in the preview above.",
  stayHandled: "Stays until handled",
  audition: (sound) => `Play: ${sound}`,
  preview: {
    label: "Notice preview",
    events: { approval: "Approval", question: "Question", yourTurn: "Your turn", done: "Finished", failed: "Failed", started: "New turn", stack: "Several" },
    play: "Play",
    stop: "Stop",
    tryOnIsland: "Try on the island",
    tryHint: "The island pops a test notice with the current settings and plays its sound; no agent gets an answer",
    tryOff: "This kind of notice is off; turn its switch on to try it",
    tryResult: {
      shown: "Test notice sent to the island: it stays out of the session list and off your phone",
      shownCard: "Test notice sent to the island: any button on it closes it, no agent gets an answer, and it closes by itself after 30 s",
      busy: "The island is showing a real notice; try again once it closes",
      expanded: "The island is open; collapse it and try again",
      muted: "The island is not showing agent notices now: game mode keeps it quiet, or agents are turned off",
      noReply: "The island did not answer; check that it is running and try again",
    },
    shrunk: (percent) => `Shown at ${percent}%`,
    hidden: {
      waiting: "\"When it waits for your approval or answer\" is off, so nothing pops up here",
      completed: "\"When a session finishes\" is off, so nothing pops up here",
      failed: "\"When a session fails\" is off, so nothing pops up here",
      title: "A new turn doesn't pop up; the collapsed bar shows its title",
      none: "A new turn shows nothing",
    },
    stay: (stay) => `Stays: ${stay}`,
    hoverHold: "paused while the pointer is on the island",
    remind: (after) => `reminds again ${after}`,
    clickNote: { window: "Click switches to the session's window, the corner opens the Agent page", page: "Click opens the Agent page, the corner switches to the session's window" },
    sound: (name) => `Sound: ${name}`,
    steps: {
      collapsed: "The collapsed island",
      handled: "Stays until handled: click a button on the card",
      remindSoon: (after) => `It pops up again ${after} if still waiting, shortened to 3 s here`,
      reminded: "Still waiting, so it reminds and sounds once more; once per wait",
      looked: "Stays until seen: move the pointer onto the card and away",
      seconds: (seconds, shown) => (shown < seconds ? `Closes after ${seconds} s, played in ${shown} s here` : `Closes after ${seconds} s`),
      hold: "Put the pointer on it and the countdown stops",
      leaving: "Closing",
      ended: "The demo ends here; the real one stays",
    },
    collapsed: "14:32 · 3 todos",
    running: "Running",
    sample: {
      prompt: "Go on, and run the regression pages when done",
      approvalTitle: "Fix clipboard image paste",
      questionTitle: "Redo the reminder settings",
      questionHeader: "Preview",
      question: "Where should the preview go?",
      questionOptions: ["Top of the page, shrinks on scroll", "A column on the right", "No preview"],
      yourTurnTitle: "Pop-up cards on the Mac notch",
      yourTurnMessage: "Two options, pick one:\n1. **Icon and state beside the notch**, body starts below it\n2. **Everything drops below**, the wings stay empty\n\nI lean towards **1**: the wings are empty anyway and it matches message alerts. It touches `IslandShell.tsx` and `AgentAlert.css`, about 80 lines.\n\nWhich one?",
      doneTitle: "Agent notice: show the whole message",
      doneMessage: "This turn is done, 6 files changed:\n1. `AgentSessionRow.tsx`: the model pill moved to the hover card\n2. `SessionBody.tsx`: the last message renders Markdown\n3. `AgentAlert.css`: up to 6 lines, longer ones scroll in the card\n4. `useIslandAgentAlerts.ts`: hovering pauses the countdown\n5. snapshots for two regression pages\n\nChecks:\n```\npnpm check            ✓\npnpm test:regression  ✓ 14 pages\n```\n**Not done yet**: the title band for the Mac notch, waiting on your call.\n\nNothing committed.",
      failedTitle: "Release 0.3.11 RC",
      failedMessage: "`pnpm release` failed before the upload:\n```\nError: TAURI_SIGNING_PRIVATE_KEY is empty\n```\nThe bundles are built but **not uploaded**, and `latest.json` is untouched.",
      startedTitle: "Redo the reminder settings: preview page",
    },
  },
};
