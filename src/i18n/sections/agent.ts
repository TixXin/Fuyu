export type AgentText = {
  running: (provider: string) => string;
  failed: (provider: string) => string;
  stale: (provider: string) => string;
  idleOrDone: string;
  autoHooks: { connected: (names: string) => string; updated: (names: string) => string; body: string; join: string };
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
    notFoundReason: Record<"notRunning" | "hidden", (app: string) => string>;
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
      view: string;
      sort: string;
      group: string;
      sortOptions: { status: string; recent: string; firstSeen: string };
      groupOptions: { computer: string; project: string; none: string };
    };
    views: {
      filterAll: string;
      filterNeed: string;
      filterRun: string;
      filterDone: string;
      filterEmpty: string;
      activeSection: (count: number) => string;
      recentDone: (count: number) => string;
      expand: string;
      collapse: string;
      backToList: string;
      latestReply: string;
      folderShort: string;
      projectsAll: string;
      projectsActive: string;
      projectCount: (total: number, active: number) => string;
      openFolder: string;
      keyFocus: string;
      keyArchive: string;
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
      hideSimilar: (name: string) => string;
      hiddenSimilar: (name: string) => string;
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
    of: (name: string) => string;
    hide: (name: string) => string;
    credits: (today: string, sevenDay: string) => string;
    balance: (total: string) => string;
    creditsUnit: string;
    creditsToday: (today: string) => string;
    balanceUnit: string;
    windowNames: Readonly<Record<string, string>>;
    layouts: Record<"strip" | "chips" | "tiles" | "lead" | "ruler" | "table", string>;
    lead: (name: string) => string;
    showAll: string;
    collapse: string;
    moreSources: (count: number) => string;
    moreWindows: (count: number) => string;
    stale: string;
    expired: (ago: string) => string;
    expiredShort: string;
    unavailable: string;
    expiredDetail: (ago: string, source: string) => string;
    expiredFix: string;
    fix: string;
    fixing: string;
    fixed: string;
    fixFailed: string;
    fiveHour: string;
    sevenDay: string;
    resetsIn: (parts: { days: number; hours: number; minutes: number }) => string;
    resetShort: (parts: { days: number; hours: number; minutes: number }) => string;
    menu: string;
    models: string;
    tightest: string;
    reset: string;
  };
  empty: {
    ago: (minutes: number) => string;
    duration: (minutes: number) => string;
    sleepTitle: string;
    sleepHint: string;
    standbyTitle: string;
    standbyHint: (count: number) => string;
    standbyNone: string;
    hooksCurrent: string;
    hooksOutdated: string;
    lastSeen: (ago: string) => string;
    neverSeen: string;
    more: (count: number) => string;
    connect: string;
    recentTitle: (hours: number) => string;
    recentHidden: (count: number) => string;
    recentEnded: (ago: string) => string;
    showHidden: (count: number) => string;
    widen: (hours: number) => string;
    quotaNone: string;
    tideTitle: string;
    tideLast: (ago: string) => string;
    tideQuiet: string;
    tideGroup: (count: number, duration: string) => string;
    tideTotal: (count: number) => string;
    tideLabel: string;
    minimal: string;
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
    toCursor: string;
    toCursorHint: string;
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
  autoHooks: { connected: (names) => `已接入 ${names}`, updated: (names) => `已更新 ${names} 的钩子`, body: "重启后生效。", join: "、" },
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
    notFoundReason: {
      notRunning: (app) => `${app} 没有打开`,
      hidden: (app) => `${app} 收在托盘里，没能唤出窗口`,
    },
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
      label: "排列与布局",
      view: "布局",
      sort: "排序",
      group: "分组",
      sortOptions: { status: "状态优先", recent: "最近活动", firstSeen: "首次出现" },
      groupOptions: { computer: "按电脑", project: "按项目", none: "不分组" },
    },
    views: {
      filterAll: "全部",
      filterNeed: "需处理",
      filterRun: "运行中",
      filterDone: "已完成",
      filterEmpty: "当前筛选下没有会话",
      activeSection: (count) => `进行中 · ${count}`,
      recentDone: (count) => `最近完成 · ${count}`,
      expand: "展开",
      collapse: "收起",
      backToList: "返回列表",
      latestReply: "最新回复",
      folderShort: "目录",
      projectsAll: "全部项目",
      projectsActive: "只看活跃",
      projectCount: (total, active) => (active > 0 ? `${total} 个会话 · ${active} 活跃` : `${total} 个会话`),
      openFolder: "打开目录",
      keyFocus: "跳转",
      keyArchive: "归档",
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
      hideSimilar: (name) => `隐藏 ${name} 这类目录的会话`,
      hiddenSimilar: (name) => `已隐藏 ${name} 这类会话`,
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
    of: (name) => `${name} 用量`,
    hide: (name) => `隐藏 ${name} 的额度`,
    credits: (today, sevenDay) => `今日 ${today} · 7 天 ${sevenDay} 积分`,
    balance: (total) => `余额 ${total}`,
    creditsUnit: "积分 · 7 天",
    creditsToday: (today) => `今日 ${today}`,
    balanceUnit: "余额",
    windowNames: { month: "本月", cursorAuto: "Auto", cursorApi: "指定模型", mcpMonth: "MCP 本月", "3p5h": "Claude / GPT 5 小时", "3p7d": "Claude / GPT 7 天" },
    layouts: { strip: "极简细条", chips: "一行胶囊", tiles: "小方块", lead: "最紧的领头", ruler: "水位刻度", table: "表格" },
    lead: (name) => `最紧 · ${name}`,
    showAll: "全部额度",
    collapse: "收起",
    moreSources: (count) => `还有 ${count} 家`,
    moreWindows: (count) => `还有 ${count} 项`,
    stale: "可能已过时",
    expired: (ago) => `已过期 · ${ago}`,
    expiredShort: "已过期",
    unavailable: "暂不可用",
    expiredDetail: (ago, source) => `额度已过重置时间，${ago}更新 · ${source}`,
    expiredFix: "点「修复」重装钩子；终端里的 Claude Code 回复一次就更新，只用桌面端时岛每 15 分钟让 Claude Code 查一次（要开着设置 → AI Agent → 用量与会话环里的「额度旧了时补查一次」）",
    fix: "修复",
    fixing: "修复中…",
    fixed: "已修复，Claude Code 回复一次或下次补查时更新",
    fixFailed: "没修好，到设置 → Agent 里重新安装钩子",
    fiveHour: "5 小时",
    sevenDay: "7 天",
    resetsIn: ({ days, hours, minutes }) =>
      days > 0 ? `${days} 天 ${hours} 小时后重置` : hours > 0 ? `${hours} 小时 ${minutes} 分后重置` : `${minutes} 分后重置`,
    resetShort: ({ days, hours, minutes }) => (days > 0 ? `${days}天${hours}小时` : hours > 0 ? `${hours}小时${minutes}分` : `${minutes}分钟`),
    menu: "调整额度显示",
    models: "其他额度",
    tightest: "只看最紧的一项",
    reset: "重置时间",
  },
  empty: {
    ago: (minutes) => (minutes < 1 ? "刚刚" : minutes < 60 ? `${minutes} 分钟前` : minutes < 1440 ? `${Math.floor(minutes / 60)} 小时前` : `${Math.floor(minutes / 1440)} 天前`),
    duration: (minutes) => (minutes < 60 ? `${minutes} 分` : minutes % 60 === 0 ? `${minutes / 60} 小时` : `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分`),
    sleepTitle: "都歇着呢",
    sleepHint: "在任意一个 Agent 里开个对话，它就会醒过来",
    standbyTitle: "没有正在跑的会话",
    standbyHint: (count) => `已接入 ${count} 家，开个对话就会出现在这里`,
    standbyNone: "还没有接入任何 Agent",
    hooksCurrent: "钩子已接好",
    hooksOutdated: "钩子需要更新",
    lastSeen: (ago) => `上次 ${ago}`,
    neverSeen: "最近没用过",
    more: (count) => `还有 ${count} 家`,
    connect: "去接入",
    recentTitle: (hours) => `${hours} 小时内没有进行中的会话`,
    recentHidden: (count) => `有 ${count} 个已结束的会话被隐藏了`,
    recentEnded: (ago) => `已结束 · ${ago}`,
    showHidden: (count) => `显示已结束的 ${count} 个`,
    widen: (hours) => `看 ${hours} 小时内`,
    quotaNone: "没有进行中的会话",
    tideTitle: "今天的潮汐",
    tideLast: (ago) => `没有进行中的会话 · 最后一次活动 ${ago}`,
    tideQuiet: "今天还没有 Agent 跑过",
    tideGroup: (count, duration) => `${count} 个 · 约 ${duration}`,
    tideTotal: (count) => `今天共 ${count} 个会话`,
    tideLabel: "今天各时段 Agent 的活动",
    minimal: "风平浪静，没有 Agent 在跑",
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
    toCursor: "去 Cursor",
    toCursorHint: "Cursor 里也会弹出确认，在那里点运行或跳过",
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
  autoHooks: { connected: (names) => `Connected ${names}`, updated: (names) => `Updated the hooks for ${names}`, body: "Restart to apply.", join: ", " },
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
    notFoundReason: {
      notRunning: (app) => `${app} is not open`,
      hidden: (app) => `${app} is in the tray; could not show its window`,
    },
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
      label: "Layout and arrange",
      view: "Layout",
      sort: "Sort",
      group: "Group",
      sortOptions: { status: "Status", recent: "Recent", firstSeen: "First seen" },
      groupOptions: { computer: "Computer", project: "Project", none: "None" },
    },
    views: {
      filterAll: "All",
      filterNeed: "Needs you",
      filterRun: "Running",
      filterDone: "Done",
      filterEmpty: "No sessions in this filter",
      activeSection: (count) => `Active · ${count}`,
      recentDone: (count) => `Completed · ${count}`,
      expand: "Show",
      collapse: "Hide",
      backToList: "Back to list",
      latestReply: "Latest reply",
      folderShort: "Folder",
      projectsAll: "All projects",
      projectsActive: "Active only",
      projectCount: (total, active) => (active > 0 ? `${total} · ${active} active` : `${total}`),
      openFolder: "Open folder",
      keyFocus: "Focus",
      keyArchive: "Archive",
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
      hideSimilar: (name) => `Hide sessions in ${name} folders`,
      hiddenSimilar: (name) => `Hid ${name} sessions`,
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
    of: (name) => `${name} usage`,
    hide: (name) => `Hide ${name} usage`,
    credits: (today, sevenDay) => `${today} today · ${sevenDay} credits in 7d`,
    balance: (total) => `Balance ${total}`,
    creditsUnit: "credits · 7d",
    creditsToday: (today) => `${today} today`,
    balanceUnit: "balance",
    windowNames: { month: "This month", cursorAuto: "Auto", cursorApi: "Named models", mcpMonth: "MCP this month", "3p5h": "Claude / GPT 5h", "3p7d": "Claude / GPT 7d" },
    layouts: { strip: "Minimal strip", chips: "Chips", tiles: "Tiles", lead: "Tightest first", ruler: "Ruler", table: "Table" },
    lead: (name) => `Tightest · ${name}`,
    showAll: "All usage",
    collapse: "Less",
    moreSources: (count) => `${count} more`,
    moreWindows: (count) => `${count} more`,
    stale: "May be out of date",
    expired: (ago) => `Expired · ${ago}`,
    expiredShort: "Expired",
    unavailable: "Unavailable",
    expiredDetail: (ago, source) => `Past its reset time; updated ${ago} · ${source}`,
    expiredFix: "Click Fix to reinstall the hooks; Claude Code in a terminal updates it on its next reply, and with only the desktop app the island has Claude Code look it up every 15 minutes (keep \"check once when usage goes stale\" on under Settings → AI Agent → Usage and session rings)",
    fix: "Fix",
    fixing: "Fixing…",
    fixed: "Fixed; updates on Claude Code's next reply or the next check",
    fixFailed: "Could not fix; reinstall the hooks under Settings → Agent",
    fiveHour: "5h",
    sevenDay: "7d",
    resetsIn: ({ days, hours, minutes }) => (days > 0 ? `resets in ${days}d${hours}h` : hours > 0 ? `resets in ${hours}h${minutes}m` : `resets in ${minutes}m`),
    resetShort: ({ days, hours, minutes }) => (days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`),
    menu: "Choose what usage to show",
    models: "Other limits",
    tightest: "Only the tightest",
    reset: "Reset time",
  },
  empty: {
    ago: (minutes) => (minutes < 1 ? "just now" : minutes < 60 ? `${minutes}m ago` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ago` : `${Math.floor(minutes / 1440)}d ago`),
    duration: (minutes) => (minutes < 60 ? `${minutes}m` : minutes % 60 === 0 ? `${minutes / 60}h` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`),
    sleepTitle: "All quiet",
    sleepHint: "Start a conversation in any agent to wake it up",
    standbyTitle: "No sessions running",
    standbyHint: (count) => `${count} connected. Start a conversation and it shows up here`,
    standbyNone: "No agents connected yet",
    hooksCurrent: "Hooks ready",
    hooksOutdated: "Hooks need an update",
    lastSeen: (ago) => `Last ${ago}`,
    neverSeen: "Not used lately",
    more: (count) => `${count} more`,
    connect: "Connect",
    recentTitle: (hours) => `No running sessions in the last ${hours}h`,
    recentHidden: (count) => (count === 1 ? "1 finished session is hidden" : `${count} finished sessions are hidden`),
    recentEnded: (ago) => `Ended ${ago}`,
    showHidden: (count) => `Show ${count} finished`,
    widen: (hours) => `Last ${hours}h`,
    quotaNone: "No running sessions",
    tideTitle: "Today's tide",
    tideLast: (ago) => `No running sessions · last active ${ago}`,
    tideQuiet: "No agent has run today",
    tideGroup: (count, duration) => `${count} · about ${duration}`,
    tideTotal: (count) => (count === 1 ? "1 session today" : `${count} sessions today`),
    tideLabel: "Agent activity by time of day",
    minimal: "Calm waters, no agent running",
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
    toCursor: "Open Cursor",
    toCursorHint: "Cursor also prompts; run or skip it there",
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
