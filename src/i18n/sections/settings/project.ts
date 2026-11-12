export type SettingsProjectText = {
  title: string;
  appName: string;
  versionChip: (version: string) => string;
  description: string;
  versionTitle: string;
  linksTitle: string;
  guide: string;
  guideHint: string;
  guideAction: string;
  resetAll: string;
  resetAllHint: string;
  resetAllConfirm: string;
  resetAllCancel: string;
  resetAllAction: string;
  quit: string;
  quitHint: string;
  quitAction: string;
  website: string;
  websiteHint: string;
  logoCall: string;
  logoCredit: string;
  logoOpen: string;
  logoCallUrl: string;
  releases: string;
  releasesHint: string;
  issues: string;
  issuesHint: string;
  star: string;
  starHint: string;
  latestRelease: string;
  latestReleaseHint: string;
  openFailed: string;
  diagnostics: {
    title: string; hint: string; preview: string; copy: string; copied: string;
    copyFailed: string; loadFailed: string; close: string;
    version: string; system: string; architecture: string; channel: string;
    autoCheck: string; interval: string; lastCheck: string; stage: string;
    enabled: string; disabled: string;
  };
  update: {
    title: string;
    hint: string;
    versionLabel: (version: string) => string;
    check: string;
    checking: string;
    upToDate: (version: string) => string;
    available: (version: string) => string;
    download: string;
    downloading: (percent: number) => string;
    downloadingUnknown: string;
    installing: string;
    done: string;
    error: string;
    errorDetail: (reason: string) => string;
    notesTitle: (version: string) => string;
    unavailable: string;
    channel: string;
    channelStable: string;
    channelBeta: string;
    channelStableHint: string;
    channelBetaHint: string;
    openPage: string;
    openPageHint: string;
    skip: string;
    unskip: string;
    skipHint: string;
    skipped: (version: string) => string;
    autoTitle: string;
    autoCheck: string;
    autoCheckHint: string;
    checkFrequency: string;
    checkFrequencyHint: string;
    frequencyHours: (hours: number) => string;
    reminderMode: string;
    reminderHint: string;
    reminderBadge: string;
    reminderNotification: string;
    autoUpdate: string;
    autoUpdateHint: string;
    autoUpdateOff: string;
    autoUpdateDownload: string;
    autoUpdateInstall: string;
    ready: (version: string) => string;
    readyIdle: (version: string) => string;
    installNow: string;
    nextCheck: (time: string) => string;
    retryCheck: (time: string) => string;
    schedulePaused: string;
    offline: string;
    pendingCheck: string;
    notificationUnavailable: string;
    notificationTitle: string;
    notificationBody: (version: string) => string;
    lastChecked: (time: string) => string;
    neverChecked: string;
    islandReminder: (version: string) => string;
  };
};

export const zhCN: SettingsProjectText = {
  title: "关于小岛",
  appName: "浮屿",
  versionChip: (version) => `v${version}`,
  description: "在屏幕顶部集中待办、剪贴板、音乐、快捷翻译、AI 状态和消息提醒。",
  versionTitle: "版本",
  linksTitle: "链接",
  guide: "新手引导",
  guideHint: "第一次启动时打开的那个窗口：语言、外观、功能开关和几个常用选项。",
  guideAction: "打开",
  resetAll: "重置所有设置",
  resetAllHint: "外观、行为和各功能的设置恢复默认。待办、笔记、邮箱、插件、密钥、样式预设和界面语言都保留。",
  resetAllConfirm: "确认重置",
  resetAllCancel: "取消",
  resetAllAction: "重置",
  quit: "退出岛屿",
  quitHint: "和托盘菜单里的「退出」一样；要再打开，从开始菜单或桌面快捷方式启动。",
  quitAction: "退出",
  website: "官网",
  websiteHint: "fuyu.tix.xin：功能介绍和下载",
  logoCall: "Logo 征集中，被采用的设计者署名在这里",
  logoCredit: "Logo 设计：",
  logoOpen: "征集中，来画一个 →",
  logoCallUrl: "https://fuyu.tix.xin/logo/",
  releases: "版本历史",
  releasesHint: "在官网查看每个版本的更新说明和下载",
  issues: "反馈与社区",
  issuesHint: "到官网社区反馈问题、交流想法",
  star: "觉得小岛还不错？",
  starHint: "去 GitHub 给小岛一颗 Star",
  latestRelease: "查看最新版本",
  latestReleaseHint: "看看小岛又长了什么新本领",
  openFailed: "暂时没能打开浏览器，请再试一次。",
  diagnostics: {
    title: "诊断信息", hint: "预览并复制应用版本、系统和更新状态，便于反馈问题。",
    preview: "预览", copy: "复制诊断信息", copied: "已复制", copyFailed: "复制失败，请重试。",
    loadFailed: "无法读取系统信息，请重试。", close: "收起",
    version: "应用版本", system: "操作系统", architecture: "架构", channel: "更新通道",
    autoCheck: "自动检查", interval: "检查频率", lastCheck: "上次成功检查", stage: "更新状态",
    enabled: "开启", disabled: "关闭",
  },
  update: {
    title: "检查更新",
    hint: "点一下看看有没有新版本",
    versionLabel: (version) => `当前版本 v${version}`,
    check: "检查",
    checking: "正在检查更新…",
    upToDate: (version) => `已是最新版本 v${version}`,
    available: (version) => `发现新版本 v${version}`,
    download: "下载并安装",
    downloading: (percent) => `正在下载 ${percent}%`,
    downloadingUnknown: "正在下载…",
    installing: "正在安装，小岛会自动重启",
    done: "更新完成，小岛正在重启…",
    error: "检查更新失败，请稍后再试。",
    errorDetail: (reason) => `原因：${reason}`,
    notesTitle: (version) => `v${version} 更新内容`,
    unavailable: "这里不能应用内更新，请到 Release 页手动下载。",
    channel: "更新通道",
    channelStable: "稳定版",
    channelBeta: "测试版（beta）",
    channelStableHint: "只接收正式版本",
    channelBetaHint: "提前体验新功能，也会收到正式版本；可能不太稳定",
    openPage: "检查更新",
    openPageHint: "在「更新」页检查新版本、选择更新通道",
    skip: "跳过这个版本",
    unskip: "取消跳过",
    skipHint: "不想装这个版本？跳过后岛上不再提醒，以后的新版本照常提醒",
    skipped: (version) => `已跳过 v${version}，岛上不再提醒；仍可在这里手动安装`,
    autoTitle: "自动检查",
    autoCheck: "自动检查更新",
    autoCheckHint: "在应用运行时按所选频率检查；退出期间错过的检查会在下次启动后补查一次。",
    checkFrequency: "检查频率",
    checkFrequencyHint: "从上次成功检查起计算，修改后立即生效。",
    frequencyHours: (hours) => `每 ${hours} 小时`,
    reminderMode: "更新提醒方式",
    reminderHint: "发现新版本后如何提醒；同一版本的系统通知只发送一次。",
    reminderBadge: "仅岛上标记",
    reminderNotification: "岛上标记与系统通知",
    autoUpdate: "自动更新",
    autoUpdateHint: "发现新版本后在后台下载（按流量计费的网络不下载）。空闲时安装：锁屏或 10 分钟没有操作、没有 Agent 在运行或等你、前台没有全屏程序时安装并重启岛屿。",
    autoUpdateOff: "只提醒",
    autoUpdateDownload: "自动下载，手动安装",
    autoUpdateInstall: "自动下载，空闲时安装",
    ready: (version) => `v${version} 已下载，点击安装`,
    readyIdle: (version) => `v${version} 已下载，空闲时自动安装`,
    installNow: "立即安装",
    nextCheck: (time) => `下次检查：${time}`,
    retryCheck: (time) => `下次重试：${time}`,
    schedulePaused: "下载或安装期间暂停自动检查",
    offline: "当前离线，联网后检查已到期的更新",
    pendingCheck: "已到检查时间，等待后台检查",
    notificationUnavailable: "系统通知不可用或被系统关闭，仍会显示岛上标记。",
    notificationTitle: "浮屿有新版本",
    notificationBody: (version) => `发现 v${version}，点击打开关于页面查看更新。`,
    lastChecked: (time) => `上次成功检查：${time}`,
    neverChecked: "还没有检查过",
    islandReminder: (version) => `发现新版本 v${version}，点击查看`,
  },
};

export const en: SettingsProjectText = {
  title: "About the island",
  appName: "Fuyu",
  versionChip: (version) => `v${version}`,
  description: "Todos, clipboard, music, quick translation, AI status, and message alerts, gathered at the top of the screen.",
  versionTitle: "Version",
  linksTitle: "Links",
  guide: "Welcome guide",
  guideHint: "The window shown on first start: language, appearance, modules and a few common choices.",
  guideAction: "Open",
  resetAll: "Reset all settings",
  resetAllHint: "Appearance, behaviour and every feature's settings go back to their defaults. Todos, notes, mailboxes, plugins, keys, style presets and the interface language are kept.",
  resetAllConfirm: "Reset",
  resetAllCancel: "Cancel",
  resetAllAction: "Reset",
  quit: "Quit the island",
  quitHint: "Same as Quit in the tray menu; start it again from the Start menu or a desktop shortcut.",
  quitAction: "Quit",
  website: "Website",
  websiteHint: "fuyu.tix.xin: features and downloads",
  logoCall: "Logo call is open: the chosen designer is credited here",
  logoCredit: "Logo by",
  logoOpen: "open call, draw one →",
  logoCallUrl: "https://fuyu.tix.xin/en/logo/",
  releases: "Version history",
  releasesHint: "Every version's notes and downloads on the website",
  issues: "Feedback and community",
  issuesHint: "Report a problem or share ideas on the website's community page",
  star: "Enjoying your little island?",
  starHint: "Give it a Star on GitHub",
  latestRelease: "View latest release",
  latestReleaseHint: "See what washed ashore in the latest update",
  openFailed: "Couldn't open your browser. Please try again.",
  diagnostics: {
    title: "Diagnostics", hint: "Preview and copy the app version, system and update status for a bug report.",
    preview: "Preview", copy: "Copy diagnostics", copied: "Copied", copyFailed: "Couldn't copy. Please try again.",
    loadFailed: "Couldn't read system information. Please try again.", close: "Hide",
    version: "App version", system: "Operating system", architecture: "Architecture", channel: "Update channel",
    autoCheck: "Automatic checks", interval: "Check frequency", lastCheck: "Last successful check", stage: "Update status",
    enabled: "On", disabled: "Off",
  },
  update: {
    title: "Check for updates",
    hint: "See whether a newer island washed ashore",
    versionLabel: (version) => `Version v${version}`,
    check: "Check",
    checking: "Checking for updates…",
    upToDate: (version) => `Already on the latest version v${version}`,
    available: (version) => `Version v${version} is available`,
    download: "Download & install",
    downloading: (percent) => `Downloading ${percent}%`,
    downloadingUnknown: "Downloading…",
    installing: "Installing — the island will restart itself",
    done: "Update installed, restarting…",
    error: "Couldn't check for updates. Please try again later.",
    errorDetail: (reason) => `Reason: ${reason}`,
    notesTitle: (version) => `What's new in v${version}`,
    unavailable: "In-app updates aren't available here. Grab new versions from the release page.",
    channel: "Update channel",
    channelStable: "Stable",
    channelBeta: "Beta",
    channelStableHint: "Only final releases",
    channelBetaHint: "Try new features early, and still get final releases; may be less stable",
    openPage: "Check for updates",
    openPageHint: "Check for new versions and pick an update channel on the Updates page",
    skip: "Skip this version",
    unskip: "Don't skip",
    skipHint: "Not this one? Skipping stops the island's reminder for it; later versions still remind you",
    skipped: (version) => `v${version} is skipped, so the island won't remind you. You can still install it here`,
    autoTitle: "Automatic checks",
    autoCheck: "Check for updates automatically",
    autoCheckHint: "Check at the selected frequency while the app is running. A missed check runs once after the next launch.",
    checkFrequency: "Check frequency",
    checkFrequencyHint: "Counted from the last successful check. Changes take effect immediately.",
    frequencyHours: (hours) => `Every ${hours} hours`,
    reminderMode: "Update reminders",
    reminderHint: "Choose how new versions are announced. Each version gets at most one system notification.",
    reminderBadge: "Island markers only",
    reminderNotification: "Markers and system notifications",
    autoUpdate: "Automatic updates",
    autoUpdateHint: "New versions download in the background (not on a metered connection). Installing when idle: with the screen locked or 10 minutes without input, no agent running or waiting on you and no full-screen app in front, the island installs and restarts.",
    autoUpdateOff: "Remind only",
    autoUpdateDownload: "Download, install by hand",
    autoUpdateInstall: "Download, install when idle",
    ready: (version) => `v${version} is downloaded; click to install`,
    readyIdle: (version) => `v${version} is downloaded and installs when the computer is idle`,
    installNow: "Install now",
    nextCheck: (time) => `Next check: ${time}`,
    retryCheck: (time) => `Next retry: ${time}`,
    schedulePaused: "Automatic checks pause during download and installation",
    offline: "Offline. Overdue updates will be checked when the connection returns",
    pendingCheck: "Check due; waiting for the background check",
    notificationUnavailable: "System notifications are unavailable or disabled. Island markers still appear.",
    notificationTitle: "A new Fuyu version is available",
    notificationBody: (version) => `Version v${version} is available. Click to open About and see the update.`,
    lastChecked: (time) => `Last successful check: ${time}`,
    neverChecked: "Not checked yet",
    islandReminder: (version) => `Version v${version} is available. Click to see it`,
  },
};
