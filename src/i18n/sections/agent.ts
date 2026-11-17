export type AgentText = {
  running: (provider: string) => string;
  failed: (provider: string) => string;
  stale: (provider: string) => string;
  idleOrDone: string;
  phase: {
    running: string;
    completed: string;
    failed: string;
    stale: string;
    waiting: string;
    idle: string;
  };
  sessions: {
    title: string;
    open: string;
    empty: string;
    emptyHint: string;
    focus: (title: string) => string;
    notFound: string;
    notFoundEnded: string;
    windowOnly: string;
    yourPrompt: (prompt: string) => string;
    activeCount: (count: number) => string;
    duration: (parts: { hours: number; minutes: number; seconds: number }) => string;
    elapsedRunning: (duration: string) => string;
    elapsedDone: (duration: string) => string;
    permissionModes: Record<"auto" | "bypass" | "acceptEdits" | "plan", string>;
    subagents: (count: number) => string;
    subagentsShow: (count: number) => string;
    subagentsHide: (count: number) => string;
    childSessions: (count: number) => string;
    childSessionsShow: (count: number) => string;
    childSessionsHide: (count: number) => string;
    childSessionsAsk: (count: number) => string;
    subagentThinking: string;
    subagentBackground: string;
    todos: (done: number, total: number) => string;
    todosCurrent: (step: string) => string;
    backgroundTasks: (count: number) => string;
    contextTokens: (size: string) => string;
    remove: (title: string) => string;
    remoteOnly: (host: string) => string;
    thisComputer: string;
    noProject: string;
    arrange: {
      label: string;
      sort: string;
      group: string;
      sortOptions: { status: string; recent: string; firstSeen: string };
      groupOptions: { computer: string; project: string; none: string };
    };
    removed: string;
    undo: string;
    extensionHint: (editor: string) => string;
    extensionInstall: string;
    extensionInstalling: string;
    extensionDone: string;
    extensionDismiss: string;
    yourTurn: string;
    compacting: string;
    lights: Record<"needs" | "yourTurn" | "working" | "stale" | "done" | "failed", string>;
    runsIn: (host: string) => string;
    toolCall: (tool: string) => string;
    menu: {
      label: (title: string) => string;
      focus: string;
      reveal: string;
      copyPath: string;
      copyId: string;
      archive: string;
      hideFolder: string;
      copied: string;
      revealFailed: string;
    };
    hover: {
      prompt: (prompt: string) => string;
      folder: (path: string) => string;
      remoteFolder: (host: string, path: string) => string;
      host: (host: string) => string;
      windowOnly: string;
    };
  };
  usage: {
    label: string;
    codexLabel: string;
    fiveHour: string;
    sevenDay: string;
    resetsIn: (parts: { days: number; hours: number; minutes: number }) => string;
    resetShort: (parts: { days: number; hours: number; minutes: number }) => string;
  };
  approval: {
    label: (tool: string) => string;
    more: (count: number) => string;
    expand: string;
    collapse: string;
    deny: string;
    allow: string;
    allowAlways: string;
    allowAlwaysHint: (rule: string) => string;
    terminal: string;
    terminalHint: string;
  };
  question: {
    label: string;
    other: string;
    submit: string;
  };
  quota: {
    low: (agent: string, window: string, used: number) => string;
    reset: (agent: string, window: string) => string;
    fiveHour: string;
    sevenDay: string;
  };
  push: Record<"waiting" | "completed" | "failed", (agent: string) => string> & { takeover: string };
};

export const zhCN: AgentText = {
  running: (provider) => `${provider} 正在运行`,
  failed: (provider) => `${provider} 运行失败`,
  stale: (provider) => `${provider} 可能已中断`,
  idleOrDone: "AI Agent 空闲或已完成",
  phase: {
    running: "正在运行",
    completed: "已完成",
    failed: "运行失败",
    stale: "可能已中断",
    waiting: "等待确认",
    idle: "空闲",
  },
  sessions: {
    title: "Agent 会话",
    open: "查看 Agent 会话",
    empty: "最近没有 Agent 会话",
    emptyHint: "在 Claude Code 或 Codex 里开始对话后会显示在这里",
    focus: (title) => `切换到「${title}」所在的窗口`,
    notFound: "没找到对应的窗口",
    notFoundEnded: "没找到对应的窗口，会话可能已经关掉了",
    windowOnly: "已切到窗口，请选会话",
    yourPrompt: (prompt) => `你：${prompt}`,
    activeCount: (count) => `${count} 个 Agent 会话正在运行，点击查看`,
    duration: ({ hours, minutes, seconds }) =>
      hours > 0 ? `${hours} 小时 ${minutes} 分` : minutes > 0 ? `${minutes} 分 ${seconds} 秒` : `${seconds} 秒`,
    elapsedRunning: (duration) => `已运行 ${duration}`,
    elapsedDone: (duration) => `用时 ${duration}`,
    permissionModes: { auto: "自动", bypass: "跳过确认", acceptEdits: "自动改文件", plan: "计划" },
    subagents: (count) => `${count} 个子 Agent`,
    subagentsShow: (count) => `展开 ${count} 个子 Agent`,
    subagentsHide: (count) => `收起 ${count} 个子 Agent`,
    childSessions: (count) => `${count} 个子会话`,
    childSessionsShow: (count) => `展开 ${count} 个子会话`,
    childSessionsHide: (count) => `收起 ${count} 个子会话`,
    childSessionsAsk: (count) => `${count} 个要你看`,
    subagentThinking: "思考中",
    subagentBackground: "后台",
    todos: (done, total) => `${done}/${total} 步`,
    todosCurrent: (step) => `正在：${step}`,
    backgroundTasks: (count) => `${count} 个后台任务`,
    contextTokens: (size) => `${size} tokens`,
    remove: (title) => `归档「${title}」`,
    remoteOnly: (host) => `没找到连着 ${host} 的终端或编辑器窗口`,
    thisComputer: "本机",
    noProject: "未知项目",
    arrange: {
      label: "排列会话",
      sort: "排序",
      group: "分组",
      sortOptions: { status: "状态优先", recent: "最近活动", firstSeen: "首次出现" },
      groupOptions: { computer: "按电脑", project: "按项目", none: "不分组" },
    },
    removed: "已归档",
    undo: "撤销",
    extensionHint: (editor) => `装上扩展，点会话能直接切到 ${editor} 里它的终端`,
    extensionInstall: "安装",
    extensionInstalling: "正在安装…",
    extensionDone: "已安装，重新加载编辑器窗口后生效",
    extensionDismiss: "不再提示",
    yourTurn: "等你回复",
    compacting: "正在压缩上下文",
    lights: { needs: "等你确认", yourTurn: "等你回复", working: "运行中", stale: "10 分钟没有动静", done: "已完成", failed: "出错了" },
    runsIn: (host) => `在 ${host} 里运行`,
    menu: {
      label: (title) => `「${title}」的更多操作`,
      focus: "跳到窗口",
      reveal: "在文件夹中显示",
      copyPath: "复制路径",
      copyId: "复制会话 id",
      archive: "归档",
      hideFolder: "隐藏这个目录的会话",
      copied: "已复制",
      revealFailed: "打不开这个文件夹",
    },
    hover: {
      prompt: (prompt) => `你：${prompt}`,
      folder: (path) => `目录：${path}`,
      remoteFolder: (host, path) => `目录：${host}:${path}`,
      host: (host) => `在 ${host} 里运行`,
      windowOnly: "点击只切到窗口，需手动选会话",
    },
    toolCall: (tool) => `正在调用 ${tool}`,
  },
  usage: {
    label: "Claude 用量",
    codexLabel: "Codex 用量",
    fiveHour: "5 小时",
    sevenDay: "7 天",
    resetsIn: ({ days, hours, minutes }) =>
      days > 0 ? `${days} 天 ${hours} 小时后重置` : hours > 0 ? `${hours} 小时 ${minutes} 分后重置` : `${minutes} 分后重置`,
    resetShort: ({ days, hours, minutes }) => (days > 0 ? `${days}天${hours}小时` : hours > 0 ? `${hours}小时${minutes}分` : `${minutes}分钟`),
  },
  approval: {
    label: (tool) => `请求使用 ${tool}`,
    more: (count) => `还有 ${count} 个`,
    expand: "展开完整内容",
    collapse: "收起",
    deny: "拒绝",
    allow: "允许",
    allowAlways: "始终允许",
    allowAlwaysHint: (rule) => `本次会话内不再询问：${rule}`,
    terminal: "到终端",
    terminalHint: "交回终端处理，并切换到它的窗口",
  },
  question: {
    label: "在问你",
    other: "其他回答…",
    submit: "提交",
  },
  quota: {
    low: (agent, window, used) => `${agent} ${window}额度已用 ${used}%`,
    reset: (agent, window) => `${agent} ${window}额度已刷新`,
    fiveHour: "5 小时",
    sevenDay: "7 天",
  },
  push: {
    waiting: (agent) => `${agent} 在等你确认或回答`,
    completed: (agent) => `${agent} 完成了这一轮`,
    failed: (agent) => `${agent} 出错了`,
    takeover: "📱 手机接管（接管后别再在电脑上答），依次发：",
  },
};

export const en: AgentText = {
  running: (provider) => `${provider} is running`,
  failed: (provider) => `${provider} failed`,
  stale: (provider) => `${provider} may have stalled`,
  idleOrDone: "AI Agent idle or finished",
  phase: {
    running: "Running",
    completed: "Done",
    failed: "Failed",
    stale: "Stalled",
    waiting: "Waiting for you",
    idle: "Idle",
  },
  sessions: {
    title: "Agent sessions",
    open: "Show agent sessions",
    empty: "No recent agent sessions",
    emptyHint: "Conversations in Claude Code or Codex show up here",
    focus: (title) => `Switch to the window running "${title}"`,
    notFound: "No matching window found",
    notFoundEnded: "No matching window; the session may have been closed",
    windowOnly: "Window focused; pick session",
    yourPrompt: (prompt) => `You: ${prompt}`,
    activeCount: (count) => (count === 1 ? "1 agent session running; click to view" : `${count} agent sessions running; click to view`),
    duration: ({ hours, minutes, seconds }) =>
      hours > 0 ? `${hours}h ${minutes}m` : minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`,
    elapsedRunning: (duration) => `running ${duration}`,
    elapsedDone: (duration) => `took ${duration}`,
    permissionModes: { auto: "Auto", bypass: "Bypass", acceptEdits: "Accept edits", plan: "Plan" },
    subagents: (count) => (count === 1 ? "1 subagent" : `${count} subagents`),
    subagentsShow: (count) => (count === 1 ? "Show 1 subagent" : `Show ${count} subagents`),
    subagentsHide: (count) => (count === 1 ? "Hide 1 subagent" : `Hide ${count} subagents`),
    childSessions: (count) => (count === 1 ? "1 child session" : `${count} child sessions`),
    childSessionsShow: (count) => (count === 1 ? "Show 1 child session" : `Show ${count} child sessions`),
    childSessionsHide: (count) => (count === 1 ? "Hide 1 child session" : `Hide ${count} child sessions`),
    childSessionsAsk: (count) => `${count} need you`,
    subagentThinking: "Thinking",
    subagentBackground: "Background",
    todos: (done, total) => `${done}/${total} steps`,
    todosCurrent: (step) => `Now: ${step}`,
    backgroundTasks: (count) => (count === 1 ? "1 background task" : `${count} background tasks`),
    contextTokens: (size) => `${size} tokens`,
    remove: (title) => `Archive "${title}"`,
    remoteOnly: (host) => `No terminal or editor window connected to ${host}`,
    thisComputer: "This computer",
    noProject: "No project",
    arrange: {
      label: "Arrange sessions",
      sort: "Sort",
      group: "Group",
      sortOptions: { status: "Status", recent: "Recent", firstSeen: "First seen" },
      groupOptions: { computer: "Computer", project: "Project", none: "None" },
    },
    removed: "Archived",
    undo: "Undo",
    extensionHint: (editor) => `Add the extension to jump straight to the session's terminal in ${editor}`,
    extensionInstall: "Install",
    extensionInstalling: "Installing…",
    extensionDone: "Installed; reload the editor window to use it",
    extensionDismiss: "Don't ask again",
    yourTurn: "Your turn",
    compacting: "Compacting context",
    lights: { needs: "Waiting for your approval", yourTurn: "Waiting for your reply", working: "Running", stale: "No activity for 10 minutes", done: "Done", failed: "Failed" },
    runsIn: (host) => `Running in ${host}`,
    menu: {
      label: (title) => `More actions for "${title}"`,
      focus: "Go to window",
      reveal: "Show in folder",
      copyPath: "Copy path",
      copyId: "Copy session id",
      archive: "Archive",
      hideFolder: "Hide sessions in this folder",
      copied: "Copied",
      revealFailed: "Couldn't open this folder",
    },
    hover: {
      prompt: (prompt) => `You: ${prompt}`,
      folder: (path) => `Folder: ${path}`,
      remoteFolder: (host, path) => `Folder: ${host}:${path}`,
      host: (host) => `Running in ${host}`,
      windowOnly: "Click focuses window only; pick session there",
    },
    toolCall: (tool) => `Calling ${tool}`,
  },
  usage: {
    label: "Claude usage",
    codexLabel: "Codex usage",
    fiveHour: "5h",
    sevenDay: "7d",
    resetsIn: ({ days, hours, minutes }) => (days > 0 ? `resets in ${days}d${hours}h` : hours > 0 ? `resets in ${hours}h${minutes}m` : `resets in ${minutes}m`),
    resetShort: ({ days, hours, minutes }) => (days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`),
  },
  approval: {
    label: (tool) => `Wants to use ${tool}`,
    more: (count) => `${count} more`,
    expand: "Show all of it",
    collapse: "Show less",
    deny: "Deny",
    allow: "Allow",
    allowAlways: "Always",
    allowAlwaysHint: (rule) => `Don't ask again this session: ${rule}`,
    terminal: "Terminal",
    terminalHint: "Hand it back to the terminal and switch to its window",
  },
  question: {
    label: "Asks you",
    other: "Something else…",
    submit: "Submit",
  },
  quota: {
    low: (agent, window, used) => `${agent} ${window} usage at ${used}%`,
    reset: (agent, window) => `${agent} ${window} usage reset`,
    fiveHour: "5-hour",
    sevenDay: "7-day",
  },
  push: {
    waiting: (agent) => `${agent} is waiting for your approval or answer`,
    completed: (agent) => `${agent} finished its turn`,
    failed: (agent) => `${agent} failed`,
    takeover: "📱 To take over on the phone (then stop answering on the computer), send in turn:",
  },
};
