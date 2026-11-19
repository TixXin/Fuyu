export type PluginMarketSort = "recommended" | "recent";
export type PluginMarketDetailTab = "readme" | "changelog" | "permissions" | "versions";
export type PluginMarketPermissionKind = "network" | "noNetwork" | "runPrograms" | "files" | "nodeSensitive" | "nodeApis" | "island" | "provides" | "replaces" | "alsoInstalls";

export type SettingsPluginMarketText = {
  count: (count: number) => string;
  indexUpdated: (time: string) => string;
  cachedAt: (time: string) => string;
  installedLink: (count: number) => string;
  refresh: string;
  refreshing: string;
  installFromFile: string;
  search: string;
  clearSearch: string;
  categoriesLabel: string;
  allCategories: string;
  sortLabel: string;
  sort: Record<PluginMarketSort, string>;
  categories: Record<string, string>;
  sections: {
    updates: (count: number) => string;
    results: (count: number) => string;
    count: (count: number) => string;
  };
  trustLine: string;
  loading: string;
  offline: { title: string; body: string; openPlugins: string };
  error: { cachedTitle: string; cachedBody: (time: string | null) => string; retry: string; title: string; body: string };
  emptyIndex: { title: string; body: string };
  noResult: { title: (query: string) => string; body: string; fromFile: string; buildOwn: string };
  card: {
    official: string;
    fresh: string;
    freshTitle: string;
    revoked: string;
    network: string;
    noNetwork: string;
    permissions: (count: number) => string;
    install: string;
    update: (version: string) => string;
    installed: string;
    manage: string;
    needsFuyu: (range: string) => string;
    needsNewerFuyu: string;
    goUpdate: string;
    platform: string;
    unavailable: string;
    review: string;
    updateLine: (from: string, to: string) => string;
    urgent: string;
  };
  detail: {
    loading: string;
    tabsLabel: string;
    tabs: Record<PluginMarketDetailTab, string>;
    noReadme: string;
    noChangelog: string;
    noVersions: string;
    reviewed: string;
    urgent: string;
    current: string;
    info: { version: string; size: string; updated: string; requires: string; platforms: string; license: string };
    requiresFuyu: (range: string) => string;
    official: string;
    likes: (count: number) => string;
    links: { repository: string; homepage: string; bugs: string; funding: string };
    commands: string;
    screenshots: string;
    platforms: Record<string, string>;
    close: string;
  };
  perms: {
    itCan: string;
    newVersionCan: string;
    titles: Record<PluginMarketPermissionKind, string>;
    noNetworkDetail: string;
    usesModules: (list: string) => string;
    ownData: string;
    ownDataNote: string;
  };
  confirm: {
    install: (name: string) => string;
    update: (name: string, version: string) => string;
    file: (name: string) => string;
    official: string;
    localFile: string;
    firstTitle: (publisher: string) => string;
    firstBody: string;
    freshInstall: string;
    freshUpdate: string;
    keyTitle: string;
    keyBody: string;
    fileTitle: string;
    fileBody: (fileName: string) => string;
    fileBodyUnknown: string;
    manualOff: string;
    manualOn: string;
    updateNote: string;
    facts: { version: string; sha256: string };
    securityNote: string;
    cancel: string;
    notNow: string;
    confirmInstall: string;
    confirmTrust: string;
    confirmUpdate: string;
    confirmKey: string;
    confirmFile: string;
    installing: string;
  };
};

export const zhCN: SettingsPluginMarketText = {
  count: (count) => `共 ${count} 个插件`,
  indexUpdated: (time) => `索引更新于 ${time}`,
  cachedAt: (time) => `缓存于 ${time}`,
  installedLink: (count) => `已装 ${count} 个 ›`,
  refresh: "刷新",
  refreshing: "正在刷新…",
  installFromFile: "从文件安装…",
  search: "搜索插件，比如 天气、GitHub、番茄钟",
  clearSearch: "清除搜索",
  categoriesLabel: "分类",
  allCategories: "全部",
  sortLabel: "排序",
  sort: { recommended: "推荐", recent: "最近更新" },
  categories: {
    productivity: "效率",
    utilities: "工具",
    todos: "待办",
    information: "资讯",
    developer: "开发",
    media: "媒体",
    ai: "AI",
    appearance: "外观",
    communication: "沟通",
  },
  sections: {
    updates: (count) => `可更新 (${count})`,
    results: (count) => `找到 ${count} 个`,
    count: (count) => `${count} 个`,
  },
  trustLine: "市场里的插件都经过签名校验；官方插件由浮屿团队发布。",
  loading: "正在读取市场目录…",
  offline: {
    title: "插件功能没在运行",
    body: "插件功能开着并且启动好之后，才能逛市场和安装插件。去插件页看看是怎么回事。",
    openPlugins: "去插件页",
  },
  error: {
    cachedTitle: "没连上插件市场",
    cachedBody: (time) => (time ? `下面是 ${time} 的缓存，能装的照样能装，最新的版本可能没列出来。` : "下面是上次读到的目录，能装的照样能装，最新的版本可能没列出来。"),
    retry: "重试",
    title: "连不上插件市场",
    body: "检查一下网络或代理再试。已经装好的插件不受影响。",
  },
  emptyIndex: {
    title: "还没有读到市场目录",
    body: "点「刷新」从插件市场取一次目录；有 .fuyu 文件也可以直接从文件安装。",
  },
  noResult: {
    title: (query) => `没找到「${query}」`,
    body: "换个说法试试，或者用英文名、作者名搜；也可以按分类看看。",
    fromFile: "有 .fuyu 文件？从文件安装",
    buildOwn: "自己做一个插件",
  },
  card: {
    official: "官方",
    fresh: "刚上架",
    freshTitle: "上架不到 3 天，浮屿平时等 3 天再自动推送",
    revoked: "已撤销",
    network: "联网",
    noNetwork: "不联网",
    permissions: (count) => `${count} 项权限`,
    install: "安装",
    update: (version) => `更新到 v${version}`,
    installed: "已安装",
    manage: "管理",
    needsFuyu: (range) => `需要浮屿 ${range}`,
    needsNewerFuyu: "需要更新浮屿",
    goUpdate: "去更新",
    platform: "不支持当前系统",
    unavailable: "暂时不能安装",
    review: "查看并更新",
    updateLine: (from, to) => `v${from} → v${to}`,
    urgent: "紧急修复",
  },
  detail: {
    loading: "正在读取插件详情…",
    tabsLabel: "插件详情",
    tabs: { readme: "说明", changelog: "更新日志", permissions: "权限", versions: "版本" },
    noReadme: "作者没有写说明。",
    noChangelog: "作者没有写更新日志。",
    noVersions: "没有版本记录。",
    reviewed: "已审核",
    urgent: "紧急修复",
    current: "已装",
    info: { version: "版本", size: "大小", updated: "更新于", requires: "需要", platforms: "平台", license: "协议" },
    requiresFuyu: (range) => `浮屿 ${range}`,
    official: "浮屿团队 · 官方",
    likes: (count) => `👍 ${count}`,
    links: { repository: "源码仓库", homepage: "主页", bugs: "反馈问题", funding: "赞助" },
    commands: "命令与快捷键",
    screenshots: "截图",
    platforms: { win32: "Windows", darwin: "macOS", linux: "Linux" },
    close: "关闭",
  },
  perms: {
    itCan: "它可以",
    newVersionCan: "新版本可以",
    titles: {
      network: "联网",
      noNetwork: "不联网",
      runPrograms: "运行电脑上的程序",
      files: "读写电脑上的文件",
      nodeSensitive: "用到系统底层能力",
      nodeApis: "用到 Node 模块",
      island: "在岛上显示",
      provides: "给别的功能提供服务",
      replaces: "接管浮屿自带的服务",
      alsoInstalls: "会一起安装",
    },
    noNetworkDetail: "不连接任何地址",
    usesModules: (list) => `用到 Node 模块 ${list}`,
    ownData: "存自己的数据",
    ownDataNote: "只能读写自己的数据目录和系统凭据管理器里自己的条目",
  },
  confirm: {
    install: (name) => `安装「${name}」？`,
    update: (name, version) => `更新「${name}」到 v${version}？`,
    file: (name) => `从文件安装「${name}」？`,
    official: "浮屿团队 · 官方",
    localFile: "本地文件",
    firstTitle: (publisher) => `第一次安装 ${publisher} 发布的插件`,
    firstBody: "市场核对过这个插件的签名。安装后会记下发布者的签名，以后它换签名密钥时浮屿会再问你。",
    freshInstall: "这个版本上架不到 3 天。浮屿平时等 3 天再自动推送新版本，你现在装就是立刻装。",
    freshUpdate: "这个版本上架不到 3 天，平时会等 3 天再自动更新；现在更新就是立刻换上。",
    keyTitle: "作者换了签名密钥",
    keyBody: "新版本用的签名和你装的版本不一样。如果不确定是不是作者本人，可以先不更新，旧版本照常运行。",
    fileTitle: "这个插件没经过市场审核",
    fileBody: (fileName) => `它来自本地文件 ${fileName}。只在你信任作者时安装：它和市场里的插件有一样的能力。`,
    fileBodyUnknown: "它来自本地文件。只在你信任作者时安装：它和市场里的插件有一样的能力。",
    manualOff: "安装时会打开「允许从文件安装插件」；在插件页右上角的 ⋯ 菜单里可以再关掉。",
    manualOn: "「允许从文件安装插件」已经打开；在插件页右上角的 ⋯ 菜单里可以关掉。",
    updateNote: "下面是新版本声明的全部能力。",
    facts: { version: "版本", sha256: "SHA-256" },
    securityNote: "插件跑在本机的插件进程里，能读写自己的数据目录和系统凭据管理器里自己的条目。",
    cancel: "取消",
    notNow: "暂不更新",
    confirmInstall: "安装",
    confirmTrust: "信任并安装",
    confirmUpdate: "更新",
    confirmKey: "确认是作者本人，更新",
    confirmFile: "仍然安装",
    installing: "正在安装…",
  },
};

export const en: SettingsPluginMarketText = {
  count: (count) => `${count} plugin${count === 1 ? "" : "s"}`,
  indexUpdated: (time) => `Index updated ${time}`,
  cachedAt: (time) => `Cached ${time}`,
  installedLink: (count) => `${count} installed ›`,
  refresh: "Refresh",
  refreshing: "Refreshing…",
  installFromFile: "Install from file…",
  search: "Search plugins, e.g. weather, GitHub, pomodoro",
  clearSearch: "Clear search",
  categoriesLabel: "Categories",
  allCategories: "All",
  sortLabel: "Sort",
  sort: { recommended: "Recommended", recent: "Recently updated" },
  categories: {
    productivity: "Productivity",
    utilities: "Utilities",
    todos: "To-dos",
    information: "News & info",
    developer: "Developer",
    media: "Media",
    ai: "AI",
    appearance: "Look",
    communication: "Communication",
  },
  sections: {
    updates: (count) => `Updates (${count})`,
    results: (count) => `${count} result${count === 1 ? "" : "s"}`,
    count: (count) => `${count}`,
  },
  trustLine: "Every plugin in the market is signature-checked; official plugins are published by the Fuyu team.",
  loading: "Loading the market…",
  offline: {
    title: "Plugins aren't running",
    body: "Plugins need to be on and started before you can browse the market or install anything. Check the plugin page to see why.",
    openPlugins: "Open plugin page",
  },
  error: {
    cachedTitle: "Couldn't reach the plugin market",
    cachedBody: (time) => (time ? `Showing the cache from ${time}. You can still install from it, but the newest versions may be missing.` : "Showing the last catalog Fuyu read. You can still install from it, but the newest versions may be missing."),
    retry: "Retry",
    title: "Can't reach the plugin market",
    body: "Check your network or proxy and try again. Installed plugins keep working.",
  },
  emptyIndex: {
    title: "No market catalog yet",
    body: "Click Refresh to fetch the catalog once. Got a .fuyu file? You can install it directly.",
  },
  noResult: {
    title: (query) => `Nothing found for “${query}”`,
    body: "Try other words, the English name or the author, or browse by category.",
    fromFile: "Got a .fuyu file? Install it",
    buildOwn: "Build your own plugin",
  },
  card: {
    official: "Official",
    fresh: "New",
    freshTitle: "Listed less than 3 days ago; Fuyu normally waits 3 days before pushing it",
    revoked: "Revoked",
    network: "Network",
    noNetwork: "Offline",
    permissions: (count) => `${count} permission${count === 1 ? "" : "s"}`,
    install: "Install",
    update: (version) => `Update to v${version}`,
    installed: "Installed",
    manage: "Manage",
    needsFuyu: (range) => `Needs Fuyu ${range}`,
    needsNewerFuyu: "Needs a newer Fuyu",
    goUpdate: "Update",
    platform: "Not for this system",
    unavailable: "Can't install now",
    review: "Review & update",
    updateLine: (from, to) => `v${from} → v${to}`,
    urgent: "Urgent fix",
  },
  detail: {
    loading: "Loading plugin details…",
    tabsLabel: "Plugin details",
    tabs: { readme: "Overview", changelog: "Changelog", permissions: "Permissions", versions: "Versions" },
    noReadme: "The author didn't write a description.",
    noChangelog: "The author didn't write a changelog.",
    noVersions: "No version history.",
    reviewed: "Reviewed",
    urgent: "Urgent fix",
    current: "Installed",
    info: { version: "Version", size: "Size", updated: "Updated", requires: "Requires", platforms: "Platforms", license: "License" },
    requiresFuyu: (range) => `Fuyu ${range}`,
    official: "Fuyu team · Official",
    likes: (count) => `👍 ${count}`,
    links: { repository: "Source", homepage: "Homepage", bugs: "Report an issue", funding: "Sponsor" },
    commands: "Commands & shortcuts",
    screenshots: "Screenshots",
    platforms: { win32: "Windows", darwin: "macOS", linux: "Linux" },
    close: "Close",
  },
  perms: {
    itCan: "It can",
    newVersionCan: "The new version can",
    titles: {
      network: "Use the network",
      noNetwork: "No network",
      runPrograms: "Run programs on this computer",
      files: "Read and write files on this computer",
      nodeSensitive: "Use low-level system features",
      nodeApis: "Use Node modules",
      island: "Show on the island",
      provides: "Provide services to other features",
      replaces: "Take over a built-in service",
      alsoInstalls: "Also installs",
    },
    noNetworkDetail: "Connects to nothing",
    usesModules: (list) => `Uses the Node modules ${list}`,
    ownData: "Keep its own data",
    ownDataNote: "Only its own data folder and its own entries in the system credential store",
  },
  confirm: {
    install: (name) => `Install “${name}”?`,
    update: (name, version) => `Update “${name}” to v${version}?`,
    file: (name) => `Install “${name}” from a file?`,
    official: "Fuyu team · Official",
    localFile: "Local file",
    firstTitle: (publisher) => `First plugin from ${publisher}`,
    firstBody: "The market verified this plugin's signature. Fuyu remembers the publisher's key and asks you again if it ever changes.",
    freshInstall: "This version was listed less than 3 days ago. Fuyu normally waits 3 days before pushing new versions; installing now skips that wait.",
    freshUpdate: "This version was listed less than 3 days ago and would normally update in 3 days; updating now switches right away.",
    keyTitle: "The author changed their signing key",
    keyBody: "The new version is signed with a different key than the one you have. If you're not sure it's really the author, skip this update; the current version keeps running.",
    fileTitle: "This plugin wasn't reviewed by the market",
    fileBody: (fileName) => `It comes from the local file ${fileName}. Only install it if you trust the author: it gets the same abilities as market plugins.`,
    fileBodyUnknown: "It comes from a local file. Only install it if you trust the author: it gets the same abilities as market plugins.",
    manualOff: "Installing turns on “Allow installing from files”; you can turn it off again in the ⋯ menu on the plugin page.",
    manualOn: "“Allow installing from files” is on; you can turn it off in the ⋯ menu on the plugin page.",
    updateNote: "Below is everything the new version declares.",
    facts: { version: "Version", sha256: "SHA-256" },
    securityNote: "Plugins run in the local plugin process and can use their own data folder and their own credential-store entries.",
    cancel: "Cancel",
    notNow: "Not now",
    confirmInstall: "Install",
    confirmTrust: "Trust and install",
    confirmUpdate: "Update",
    confirmKey: "It's the author, update",
    confirmFile: "Install anyway",
    installing: "Installing…",
  },
};
