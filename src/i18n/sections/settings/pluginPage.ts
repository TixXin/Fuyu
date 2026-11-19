export type PluginPageRowLabel = "off" | "failed" | "paused" | "waiting" | "safe" | "unknown" | "bisect" | "starting" | "stopped" | "waitingRuntime";

export type PluginPageDetailTab = "overview" | "settings" | "commands" | "activity";

export type PluginPagePlace = "page" | "bar" | "alerts" | "translate" | "settings";

export type SettingsPluginPageText = {
  browseMarket: string;
  moreActions: string;
  menu: {
    installFromFile: string;
    allowFiles: string;
    allowFilesHint: string;
    checkUpdates: string;
    checkingUpdates: string;
    diagnostics: string;
    devDocs: string;
  };
  summary: {
    installed: (count: number) => string;
    running: (count: number) => string;
    off: (count: number) => string;
    attention: (count: number) => string;
  };
  search: string;
  clearSearch: string;
  filtersLabel: string;
  filters: { all: string; on: string; off: string; attention: string };
  noMatch: (query: string) => string;
  searchMarket: string;
  loading: string;
  footnote: { before: string; link: string; after: string };
  empty: { title: string; body: string; popular: string; install: string };
  badges: { unreviewed: string };
  sources: { market: string; official: string; manual: string; local: string };
  places: Record<PluginPagePlace, string>;
  placesLabel: string;
  openPageTitle: (name: string) => string;
  pageOffTitle: string;
  openSettingsTitle: string;
  versions: { localNewer: (version: string) => string; local: (version: string) => string };
  suggest: { title: string; all: (count: number) => string; browse: string; browseHint: string };
  labels: Record<PluginPageRowLabel, string>;
  running: string;
  notes: {
    paused: (errors: number, seconds: number) => string;
    waitingOff: (name: string) => string;
    waitingStarting: (name: string) => string;
    waitingNobody: string;
    unreachable: (windows: string) => string;
    revoked: string;
    warned: string;
    held: (version: string) => string;
    heldItem: (what: string, list: string) => string;
    revokedSwitch: string;
    revokedError: (reasons: string) => string;
    trust: (version: string) => string;
    update: (version: string) => string;
    updateFresh: (version: string) => string;
  };
  actions: {
    restart: string;
    turnBackOn: string;
    viewLog: string;
    update: string;
    updateNow: string;
    whatsNew: string;
    review: string;
    reviewUpdate: string;
    turnOn: (name: string) => string;
    uninstall: string;
    remove: string;
    settings: string;
    enabled: (name: string) => string;
  };
  banners: {
    viewDiagnostics: string;
    runtimeDownloading: string;
    runtimeDownloadingBody: string;
    runtimeSize: (downloaded: string, total: string) => string;
    runtimeSizeUnknown: (downloaded: string) => string;
    runtimeFailed: string;
    runtimeFailedBody: string;
    retry: string;
    safe: string;
    safeFailures: (count: number) => string;
    safeShift: string;
    safeVariable: string;
    safeMinimal: string;
    leaveSafe: string;
    findCulprit: string;
    howToRemove: string;
    offline: string;
    offlineBody: string;
    mismatch: string;
    mismatchBody: string;
    hostOff: string;
    hostOffBody: string;
    howToTurnOn: string;
    updates: (count: number) => string;
    updatesBody: (names: string) => string;
    problems: (count: number) => string;
    problemsBody: string;
    attention: (count: number) => string;
    attentionBody: string;
    onlyAttention: string;
  };
  migration: {
    title: string;
    summary: string;
    collapse: string;
    expand: (count: number) => string;
    oldPlugin: string;
    switched: string;
    switchedKept: string;
    ready: string;
    readyKept: string;
    getIt: string;
    unavailable: string;
    openMarket: string;
    dismiss: string;
  };
  detail: {
    tabs: Record<PluginPageDetailTab, string>;
    close: string;
    facts: { version: string; marketVersion: string; source: string; publisher: string; state: string; id: string };
    where: string;
    openOnIsland: string;
    newerThanMarket: (local: string, market: string) => string;
    technical: string;
    noSettings: string;
    settingsOff: string;
    commandsEmpty: string;
    noShortcut: string;
    change: string;
    set: string;
    conflict: string;
    run: string;
    running: string;
    ran: string;
    runFailed: (reason: string) => string;
    runNotHandled: string;
    runBlocked: Record<"offline" | "off" | "notRunning", string>;
    shortcutsBefore: string;
    shortcutsLink: string;
    shortcutsAfter: string;
    windows: string;
    lastError: string;
    noErrors: string;
    copy: string;
    copied: string;
    restartPlugin: string;
    activityNote: string;
    viewInMarket: string;
    uninstall: string;
    uninstallPrompt: (name: string) => string;
    uninstallNote: string;
    removeData: string;
    cancel: string;
    confirmUninstall: string;
    uninstalling: string;
    remove: string;
    removePrompt: (name: string) => string;
    removeNote: string;
    removeNoteFile: string;
    confirmRemove: string;
    removing: string;
  };
  diagnostics: {
    process: string;
    processNote: string;
    states: { connecting: string; open: string; reconnecting: string; failed: string; closed: string };
    processDetail: (pid: number, node: string) => string;
    hostOff: string;
    bisectTitle: string;
    bisectIntro: string;
    bisectStart: string;
    bisectNone: string;
    allModules: string;
    allModulesMeta: (plugins: number, builtins: number) => string;
    name: string;
    kindPlugin: string;
    kindBuiltin: string;
    showAll: (count: number) => string;
    showLess: string;
    footnote: string;
    marketSource: (name: string, time: string) => string;
  };
};

export const zhCN: SettingsPluginPageText = {
  browseMarket: "浏览插件市场",
  moreActions: "更多操作",
  menu: {
    installFromFile: "从文件安装…",
    allowFiles: "允许从文件安装插件",
    allowFilesHint: "关掉后，双击 .fuyu 文件也不会弹出安装",
    checkUpdates: "检查插件更新",
    checkingUpdates: "正在检查…",
    diagnostics: "运行诊断",
    devDocs: "插件开发文档",
  },
  summary: {
    installed: (count) => `装了 ${count} 个插件`,
    running: (count) => `${count} 个在运行`,
    off: (count) => `${count} 个已停用`,
    attention: (count) => `${count} 个要处理`,
  },
  search: "搜索已装的插件",
  clearSearch: "清除搜索",
  filtersLabel: "筛选",
  filters: { all: "全部", on: "已启用", off: "已停用", attention: "需处理" },
  noMatch: (query) => `没有和「${query}」匹配的已装插件。`,
  searchMarket: "去市场搜",
  loading: "正在读取已装的插件…",
  footnote: { before: "浮屿自带的功能（待办、音乐、剪贴板……）不算插件，在", link: "「概览」", after: "里开关。" },
  empty: {
    title: "还没有装插件",
    body: "插件给岛加新本事：看天气、收 GitHub 提醒、订阅新闻……都在插件市场里，点一下就装。",
    popular: "大家都在装",
    install: "安装",
  },
  badges: { unreviewed: "未经审核" },
  sources: { market: "插件市场", official: "插件市场", manual: "从文件安装", local: "从文件夹加载" },
  places: { page: "岛上页面", bar: "收起条", alerts: "岛上提醒", translate: "快捷翻译里", settings: "有设置" },
  placesLabel: "在岛上的位置",
  openPageTitle: (name) => `展开岛，切到「${name}」这一页`,
  pageOffTitle: "插件开着时才能在岛上打开",
  openSettingsTitle: "打开这个插件的设置",
  versions: { localNewer: (version) => `本地版本 v${version}（比市场新）`, local: (version) => `v${version}（本地）` },
  suggest: { title: "还可以装这些", all: (count) => `全部 ${count} 个 ›`, browse: "浏览插件市场", browseHint: "按分类看全部插件" },
  labels: {
    off: "已停用",
    failed: "启动失败",
    paused: "已暂停",
    waiting: "等待中",
    safe: "安全模式下没启动",
    unknown: "状态未知",
    bisect: "排查中临时停用",
    starting: "正在启动",
    stopped: "没在运行",
    waitingRuntime: "等运行环境",
  },
  running: "运行中",
  notes: {
    paused: (errors, seconds) => `${seconds} 秒内出错 ${errors} 次，先停到下次启动浮屿`,
    waitingOff: (name) => `要用「${name}」，但它现在关着`,
    waitingStarting: (name) => `在等「${name}」准备好`,
    waitingNobody: "要用另一个插件提供的功能，现在还没有插件提供它",
    unreachable: (windows) => `界面文件（${windows}）不在浮屿能读的文件夹里，这部分界面不会显示`,
    revoked: "市场撤销了这个版本，它不能再打开，建议卸载",
    warned: "市场对这个版本发出了提醒，插件照常运行",
    held: (version) => `新版本 v${version} 会做更多事，需要你确认后再更新`,
    heldItem: (what, list) => `${what}：${list}`,
    revokedSwitch: "市场撤销了这个版本，不能打开",
    revokedError: (reasons) => `市场撤销了这个版本，不能打开：${reasons}`,
    trust: (version) => `作者换了签名密钥，新版本 v${version} 要你确认是本人后才更新`,
    update: (version) => `有新版本 v${version}`,
    updateFresh: (version) => `v${version} 刚上架，3 天后自动更新`,
  },
  actions: {
    restart: "重启",
    turnBackOn: "重新启用",
    viewLog: "查看日志",
    update: "更新",
    updateNow: "现在更新",
    whatsNew: "看更新内容",
    review: "查看",
    reviewUpdate: "看看再更新",
    turnOn: (name) => `打开「${name}」`,
    uninstall: "卸载…",
    remove: "从浮屿移除…",
    settings: "设置",
    enabled: (name) => `启用「${name}」`,
  },
  banners: {
    viewDiagnostics: "查看运行诊断",
    runtimeDownloading: "正在准备插件运行环境",
    runtimeDownloadingBody: "这台电脑上没有合适的 Node.js，浮屿把它下载到自己的数据目录，只下一次。下完插件会自动启动。",
    runtimeSize: (downloaded, total) => `${downloaded} / ${total} MB`,
    runtimeSizeUnknown: (downloaded) => `${downloaded} MB`,
    runtimeFailed: "没能下载插件运行环境",
    runtimeFailedBody: "下载走系统代理；网络好了点「重试」，不用重启浮屿。",
    retry: "重试",
    safe: "安全模式：你装的插件这次没有启动",
    safeFailures: (count) => `插件连续 ${count} 次没能正常跑满 1 分钟，浮屿这次先不启动你装的插件。安全模式下正常运行 1 分钟后，下次启动就恢复。`,
    safeShift: "启动时按住了 Shift，这次先不启动你装的插件。下次正常启动就恢复。",
    safeVariable: "这次是用启动参数打开的安全模式，要去掉那个参数再重启浮屿才会退出。",
    safeMinimal: "这次连一部分自带功能也没有启动。",
    leaveSafe: "退出安全模式",
    findCulprit: "找出是哪个插件",
    howToRemove: "怎么去掉启动参数？",
    offline: "插件进程连不上，正在重连…",
    offlineBody: "下面是上次看到的状态，开关暂时不能用。重连一直不成功的话，重启浮屿试试。",
    mismatch: "插件进程连不上",
    mismatchBody: "浮屿和插件进程的版本对不上，重启浮屿试试。",
    hostOff: "插件功能被启动参数关掉了",
    hostOffBody: "你装的插件这次都不会运行，设置和数据都还在。去掉那个启动参数、重启浮屿就恢复。",
    howToTurnOn: "怎么打开？",
    updates: (count) => `${count} 个插件有新版本`,
    updatesBody: (names) => `${names}。官方插件平时会自动更新，刚上架的版本等 3 天。`,
    problems: (count) => `${count} 个插件出了问题`,
    problemsBody: "每个插件的处理按钮在下面那一行上。",
    attention: (count) => `${count} 个插件等你处理`,
    attentionBody: "要你确认的更新、在等别的功能、被市场撤销的插件，处理按钮都在各自那一行上。",
    onlyAttention: "只看需处理的",
  },
  migration: {
    title: "旧插件要换成新版",
    summary: "浮屿换了一套新的插件系统，旧插件不会再运行。官方插件都出了新版，原来的设置已经带过来了。",
    collapse: "收起",
    expand: (count) => `展开 ${count} 项`,
    oldPlugin: "旧版插件",
    switched: "已换成新版",
    switchedKept: "已换成新版，原来的设置带过来了",
    ready: "新版在市场里",
    readyKept: "新版在市场里，设置已经备好",
    getIt: "去安装",
    unavailable: "作者还没出新版，暂时用不了",
    openMarket: "去插件市场",
    dismiss: "知道了，不再提示",
  },
  detail: {
    tabs: { overview: "概览", settings: "设置", commands: "命令与快捷键", activity: "运行情况" },
    close: "关闭",
    facts: { version: "版本", marketVersion: "市场上", source: "来源", publisher: "发布者", state: "状态", id: "标识" },
    where: "出现在",
    openOnIsland: "在岛上打开",
    newerThanMarket: (local, market) => `这个版本是从文件装的，比市场上的 v${market} 新。文件没经过市场核对，所以名字旁边没有官方对勾。市场上出了比 v${local} 更新的版本时，插件页这一行会提示你更新。`,
    technical: "细节",
    noSettings: "这个插件没有可以改的设置。",
    settingsOff: "插件运行时，这里才会显示它自己的设置（如果有的话）。",
    commandsEmpty: "这个插件没有登记命令。",
    noShortcut: "没设快捷键",
    change: "改",
    set: "设置",
    conflict: "和别的快捷键冲突",
    run: "运行",
    running: "正在运行…",
    ran: "已运行",
    runFailed: (reason) => `没运行成功：${reason}`,
    runNotHandled: "插件没有接上这个命令，要等插件更新",
    runBlocked: { offline: "插件进程没连上，暂时不能运行命令。", off: "插件关着，打开它才能运行命令。", notRunning: "插件现在没在运行，等它运行起来才能运行命令。" },
    shortcutsBefore: "所有插件的快捷键也在",
    shortcutsLink: "「快捷键」",
    shortcutsAfter: "页里。",
    windows: "独立窗口",
    lastError: "最近一次出错",
    noErrors: "这次启动以来没有出过错。",
    copy: "复制",
    copied: "已复制",
    restartPlugin: "重启插件",
    activityNote: "CPU 是近似值：只算登记过的回调（事件、定时器、启动）的同步部分。",
    viewInMarket: "在市场查看",
    uninstall: "卸载",
    uninstallPrompt: (name) => `卸载「${name}」？`,
    uninstallNote: "插件马上移除。",
    removeData: "同时删除它的数据（设置、缓存）",
    cancel: "取消",
    confirmUninstall: "卸载",
    uninstalling: "正在卸载…",
    remove: "从浮屿移除",
    removePrompt: (name) => `从浮屿移除「${name}」？`,
    removeNote: "只删掉这条登记，不会删除插件文件夹；再次运行 fuyu-plugin dev 会重新出现。",
    removeNoteFile: "只从 plugins.yml 删掉这条登记，不会删除插件文件夹。",
    confirmRemove: "移除",
    removing: "正在移除…",
  },
  diagnostics: {
    process: "插件进程",
    processNote: "你装的插件都跑在这个进程里",
    states: { connecting: "正在连接", open: "正常运行", reconnecting: "重连中", failed: "连不上", closed: "已断开" },
    processDetail: (pid, node) => `进程 ${pid} · Node ${node}`,
    hostOff: "插件功能被启动参数关掉了，这次没有插件进程。",
    bisectTitle: "找出出问题的插件",
    bisectIntro: "浮屿变卡或出错，又不知道是哪个插件？一步步临时停用一半你装的插件，几步就能找到。排查期间不改你的设置。",
    bisectStart: "开始排查",
    bisectNone: "装了插件才能排查。",
    allModules: "全部模块",
    allModulesMeta: (plugins, builtins) => `你装的 ${plugins} 个插件 + 浮屿自带的 ${builtins} 个模块`,
    name: "名称",
    kindPlugin: "插件",
    kindBuiltin: "内置",
    showAll: (count) => `显示全部 ${count} 个`,
    showLess: "收起",
    footnote: "CPU 是近似值：只算登记过的回调（事件、定时器、启动）的同步部分。点一行打开那个插件；内置模块的开关在各自的设置页。",
    marketSource: (name, time) => `插件市场最近一次下载走的是 ${name}（${time}）。连不上 GitHub 时会自动换镜像，校验照旧。`,
  },
};

export const en: SettingsPluginPageText = {
  browseMarket: "Browse the market",
  moreActions: "More actions",
  menu: {
    installFromFile: "Install from file…",
    allowFiles: "Allow installing from files",
    allowFilesHint: "When off, double-clicking a .fuyu file won't offer to install it",
    checkUpdates: "Check for plugin updates",
    checkingUpdates: "Checking…",
    diagnostics: "Diagnostics",
    devDocs: "Plugin developer docs",
  },
  summary: {
    installed: (count) => `${count} ${count === 1 ? "plugin" : "plugins"} installed`,
    running: (count) => `${count} running`,
    off: (count) => `${count} off`,
    attention: (count) => `${count} need${count === 1 ? "s" : ""} you`,
  },
  search: "Search installed plugins",
  clearSearch: "Clear search",
  filtersLabel: "Filter",
  filters: { all: "All", on: "On", off: "Off", attention: "Needs you" },
  noMatch: (query) => `No installed plugin matches “${query}”.`,
  searchMarket: "Search the market",
  loading: "Loading installed plugins…",
  footnote: { before: "Built-in features (to-dos, music, clipboard…) aren't plugins; turn them on or off in ", link: "Overview", after: "." },
  empty: {
    title: "No plugins yet",
    body: "Plugins teach the island new tricks: weather, GitHub alerts, news feeds… They're all in the plugin market, one click to install.",
    popular: "Popular",
    install: "Install",
  },
  badges: { unreviewed: "Unreviewed" },
  sources: { market: "Plugin market", official: "Plugin market", manual: "Installed from a file", local: "Loaded from a folder" },
  places: { page: "Island page", bar: "Collapsed bar", alerts: "Island alerts", translate: "In Quick translate", settings: "Has settings" },
  placesLabel: "Where it shows up on the island",
  openPageTitle: (name) => `Expand the island and switch to “${name}”`,
  pageOffTitle: "Turn the plugin on to open it on the island",
  openSettingsTitle: "Open this plugin's settings",
  versions: { localNewer: (version) => `Local version v${version} (newer than the market)`, local: (version) => `v${version} (local)` },
  suggest: { title: "More to try", all: (count) => `All ${count} ›`, browse: "Browse the plugin market", browseHint: "See every plugin by category" },
  labels: {
    off: "Off",
    failed: "Failed to start",
    paused: "Paused",
    waiting: "Waiting",
    safe: "Held by safe mode",
    unknown: "Status unknown",
    bisect: "Off while troubleshooting",
    starting: "Starting",
    stopped: "Not running",
    waitingRuntime: "Waiting for runtime",
  },
  running: "Running",
  notes: {
    paused: (errors, seconds) => `${errors} errors within ${seconds} s; paused until Fuyu restarts`,
    waitingOff: (name) => `Needs ${name}, which is turned off`,
    waitingStarting: (name) => `Waiting for ${name} to be ready`,
    waitingNobody: "Needs a feature from another plugin, and no plugin offers it yet",
    unreachable: (windows) => `Its window files (${windows}) are outside the folders Fuyu can read, so those parts won't show`,
    revoked: "The market revoked this version; it can't be turned on again, and uninstalling is recommended",
    warned: "The market flagged this version; the plugin keeps running",
    held: (version) => `v${version} does more than this version, so it waits for you to confirm the update`,
    heldItem: (what, list) => `${what}: ${list}`,
    revokedSwitch: "The market revoked this version, so it can't be turned on",
    revokedError: (reasons) => `The market revoked this version, so it can't be turned on: ${reasons}`,
    trust: (version) => `The author changed their signing key; confirm it's really them before v${version} installs`,
    update: (version) => `v${version} is available`,
    updateFresh: (version) => `v${version} just landed; it auto-updates in 3 days`,
  },
  actions: {
    restart: "Restart",
    turnBackOn: "Turn back on",
    viewLog: "View log",
    update: "Update",
    updateNow: "Update now",
    whatsNew: "What's new",
    review: "Review",
    reviewUpdate: "Review update",
    turnOn: (name) => `Turn on ${name}`,
    uninstall: "Uninstall…",
    remove: "Remove from Fuyu…",
    settings: "Settings",
    enabled: (name) => `Enable ${name}`,
  },
  banners: {
    viewDiagnostics: "View diagnostics",
    runtimeDownloading: "Setting up the plugin runtime",
    runtimeDownloadingBody: "No suitable Node.js on this computer. Fuyu downloads one into its own data folder, just once. Plugins start automatically when it's done.",
    runtimeSize: (downloaded, total) => `${downloaded} / ${total} MB`,
    runtimeSizeUnknown: (downloaded) => `${downloaded} MB`,
    runtimeFailed: "Couldn't download the plugin runtime",
    runtimeFailedBody: "Downloads use the system proxy; retry once you're online, no restart needed.",
    retry: "Retry",
    safe: "Safe mode: your plugins didn't start this time",
    safeFailures: (count) => `Plugins failed to run for a full minute ${count} times in a row, so Fuyu didn't start your plugins this time. After a minute of normal running in safe mode, the next launch is back to normal.`,
    safeShift: "Shift was held at launch, so your plugins didn't start this time. The next normal launch is back to normal.",
    safeVariable: "Safe mode was turned on with a launch option; remove it and restart Fuyu to leave.",
    safeMinimal: "Some built-in features were held back too.",
    leaveSafe: "Leave safe mode",
    findCulprit: "Find the culprit",
    howToRemove: "How do I remove it?",
    offline: "Can't reach the plugin process, reconnecting…",
    offlineBody: "Showing the last known state; switches are unavailable for now. If it keeps failing, restart Fuyu.",
    mismatch: "Can't reach the plugin process",
    mismatchBody: "Fuyu and the plugin process don't match versions; try restarting Fuyu.",
    hostOff: "Plugins are turned off by a launch option",
    hostOffBody: "None of your plugins run this time; their settings and data are kept. Remove the launch option and restart Fuyu.",
    howToTurnOn: "How to turn it back on?",
    updates: (count) => `${count} ${count === 1 ? "plugin has an update" : "plugins have updates"}`,
    updatesBody: (names) => `${names}. Official plugins update automatically; brand-new versions wait 3 days.`,
    problems: (count) => `${count} ${count === 1 ? "plugin ran" : "plugins ran"} into problems`,
    problemsBody: "Fix buttons are on each row below.",
    attention: (count) => `${count} ${count === 1 ? "plugin needs" : "plugins need"} you`,
    attentionBody: "Updates to confirm, plugins waiting for a feature and plugins the market revoked each have their buttons on their own row.",
    onlyAttention: "Show only these",
  },
  migration: {
    title: "Your old plugins need new versions",
    summary: "Fuyu moved to a new plugin system and old plugins no longer run. Official plugins have new versions and your settings have been carried over.",
    collapse: "Collapse",
    expand: (count) => `Show ${count}`,
    oldPlugin: "Old plugin",
    switched: "Switched to the new version",
    switchedKept: "Switched to the new version; settings carried over",
    ready: "New version is in the market",
    readyKept: "New version is in the market; settings are ready",
    getIt: "Get it",
    unavailable: "No new version from the author yet; unavailable for now",
    openMarket: "Open market",
    dismiss: "Got it, don't show again",
  },
  detail: {
    tabs: { overview: "Overview", settings: "Settings", commands: "Commands & shortcuts", activity: "Activity" },
    close: "Close",
    facts: { version: "Version", marketVersion: "In the market", source: "Source", publisher: "Publisher", state: "State", id: "ID" },
    where: "Shows up in",
    openOnIsland: "Open on the island",
    newerThanMarket: (local, market) => `This version was installed from a file and is newer than v${market} in the market. Files aren't checked by the market, so there is no official check mark. When the market has something newer than v${local}, this plugin's row will offer the update.`,
    technical: "Details",
    noSettings: "This plugin has no settings.",
    settingsOff: "Its own settings show up here while the plugin is running, if it has any.",
    commandsEmpty: "This plugin has no commands.",
    noShortcut: "No shortcut",
    change: "Change",
    set: "Set",
    conflict: "Conflicts with another shortcut",
    run: "Run",
    running: "Running…",
    ran: "Done",
    runFailed: (reason) => `Couldn't run: ${reason}`,
    runNotHandled: "the plugin doesn't handle this command yet; it needs an update",
    runBlocked: { offline: "The plugin process isn't connected, so commands can't run right now.", off: "The plugin is off. Turn it on to run its commands.", notRunning: "The plugin isn't running right now. Commands can run once it starts." },
    shortcutsBefore: "All plugin shortcuts are also on the ",
    shortcutsLink: "Shortcuts",
    shortcutsAfter: " page.",
    windows: "Separate windows",
    lastError: "Last error",
    noErrors: "No errors since Fuyu started.",
    copy: "Copy",
    copied: "Copied",
    restartPlugin: "Restart plugin",
    activityNote: "CPU is approximate: only the synchronous part of registered callbacks (events, timers, startup).",
    viewInMarket: "View in market",
    uninstall: "Uninstall",
    uninstallPrompt: (name) => `Uninstall “${name}”?`,
    uninstallNote: "The plugin is removed right away.",
    removeData: "Also delete its data (settings, cache)",
    cancel: "Cancel",
    confirmUninstall: "Uninstall",
    uninstalling: "Uninstalling…",
    remove: "Remove from Fuyu",
    removePrompt: (name) => `Remove “${name}” from Fuyu?`,
    removeNote: "Only its registration is removed; the plugin folder stays. Running fuyu-plugin dev again brings it back.",
    removeNoteFile: "Only its entry in plugins.yml is removed; the plugin folder stays.",
    confirmRemove: "Remove",
    removing: "Removing…",
  },
  diagnostics: {
    process: "Plugin process",
    processNote: "All your plugins run in this process",
    states: { connecting: "Connecting", open: "Running", reconnecting: "Reconnecting", failed: "Can't connect", closed: "Disconnected" },
    processDetail: (pid, node) => `Process ${pid} · Node ${node}`,
    hostOff: "Plugins are turned off by a launch option, so there's no plugin process this time.",
    bisectTitle: "Find a misbehaving plugin",
    bisectIntro: "Fuyu slow or misbehaving and you don't know which plugin? Temporarily turn off half your plugins at a time to narrow it down in a few steps. Your settings aren't changed.",
    bisectStart: "Start",
    bisectNone: "Install a plugin first to troubleshoot.",
    allModules: "All modules",
    allModulesMeta: (plugins, builtins) => `${plugins} plugins + ${builtins} built-in modules`,
    name: "Name",
    kindPlugin: "Plugin",
    kindBuiltin: "Built-in",
    showAll: (count) => `Show all ${count}`,
    showLess: "Show less",
    footnote: "CPU is approximate: only the synchronous part of registered callbacks (events, timers, startup). Click a row to open that plugin; built-in modules are switched on their own settings pages.",
    marketSource: (name, time) => `The plugin market last downloaded through ${name} (${time}). When GitHub can't be reached it switches to a mirror; everything is still verified.`,
  },
};
