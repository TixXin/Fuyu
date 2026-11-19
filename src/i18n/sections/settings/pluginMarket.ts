export type PluginMarketSort = "recommended" | "newest" | "recent";
export type PluginMarketDetailTab = "readme" | "changelog" | "versions";
export type PluginCapabilityKind = "replaces" | "network" | "runPrograms" | "files" | "nodeSensitive" | "nodeApis";

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
    fresh: string;
    installed: (count: number) => string;
    showInstalled: string;
    hideInstalled: string;
    allInstalled: string;
  };
  trustLine: string;
  loading: string;
  offline: { title: string; body: string; openPlugins: string };
  error: { cachedTitle: string; cachedBody: (time: string | null) => string; retry: string; title: string; body: string };
  emptyIndex: { title: string; body: string };
  noResult: { title: (query: string) => string; body: string; fromFile: string; buildOwn: string };
  card: {
    officialTitle: string;
    isNew: string;
    isNewTitle: string;
    fresh: string;
    revoked: string;
    network: string;
    noNetwork: string;
    install: string;
    update: (version: string) => string;
    installed: string;
    manage: string;
    openOnIsland: string;
    openOnIslandTitle: (name: string) => string;
    shotCount: (count: number) => string;
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
    zoomShot: (index: number, total: number) => string;
    viewer: { label: string; prev: string; next: string; close: string; position: (index: number, total: number) => string };
    platforms: Record<string, string>;
    close: string;
  };
  capabilities: {
    heading: string;
    titles: Record<PluginCapabilityKind, string>;
    usesModules: (list: string) => string;
    note: string;
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
  sort: { recommended: "推荐", newest: "最新上架", recent: "最近更新" },
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
    fresh: "还没装的",
    installed: (count) => `已安装 (${count})`,
    showInstalled: "展开",
    hideInstalled: "收起",
    allInstalled: "市场上的插件你都装了。有新插件上架时会出现在这里。",
  },
  trustLine: "市场里的插件都经过签名校验；名字旁带对勾的是浮屿团队发布的官方插件。",
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
    officialTitle: "浮屿团队发布",
    isNew: "新",
    isNewTitle: "上架不到 14 天",
    fresh: "刚上架",
    revoked: "已撤销",
    network: "联网",
    noNetwork: "不联网",
    install: "安装",
    update: (version) => `更新到 v${version}`,
    installed: "已安装",
    manage: "管理",
    openOnIsland: "在岛上打开",
    openOnIslandTitle: (name) => `展开岛，切到「${name}」`,
    shotCount: (count) => `共 ${count} 张`,
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
    tabs: { readme: "说明", changelog: "更新日志", versions: "版本" },
    noReadme: "作者没有写说明。",
    noChangelog: "作者没有写更新日志。",
    noVersions: "没有版本记录。",
    reviewed: "已审核",
    urgent: "紧急修复",
    current: "已装",
    info: { version: "版本", size: "大小", updated: "更新于", requires: "需要", platforms: "平台", license: "协议" },
    requiresFuyu: (range) => `浮屿 ${range}`,
    official: "浮屿团队",
    likes: (count) => `👍 ${count}`,
    links: { repository: "源码仓库", homepage: "主页", bugs: "反馈问题", funding: "赞助" },
    commands: "命令与快捷键",
    screenshots: "截图",
    zoomShot: (index, total) => `放大看第 ${index} 张截图，共 ${total} 张`,
    viewer: { label: "截图", prev: "上一张", next: "下一张", close: "关闭", position: (index, total) => `${index} / ${total}` },
    platforms: { win32: "Windows", darwin: "macOS", linux: "Linux" },
    close: "关闭",
  },
  capabilities: {
    heading: "它会做什么",
    titles: {
      replaces: "替换浮屿内置的服务",
      network: "连接这些地址",
      runPrograms: "运行电脑上的程序",
      files: "读写电脑上的文件",
      nodeSensitive: "用到系统底层能力",
      nodeApis: "用到 Node 模块",
    },
    usesModules: (list) => `通过 Node 模块 ${list}`,
    note: "按插件清单整理。浮屿不会限制插件只做这些。",
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
    facts: { version: "版本", sha256: "SHA-256" },
    securityNote: "插件能做浮屿能做的事，比如读写文件、联网、运行程序，浮屿不会替你拦。只装你信任的插件。",
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
  sort: { recommended: "Recommended", newest: "Newest", recent: "Recently updated" },
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
    fresh: "Not installed",
    installed: (count) => `Installed (${count})`,
    showInstalled: "Show",
    hideInstalled: "Hide",
    allInstalled: "You have every plugin in the market. New ones will show up here.",
  },
  trustLine: "Every plugin in the market is signature-checked; a check mark next to the name means it's an official plugin from the Fuyu team.",
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
    officialTitle: "Published by the Fuyu team",
    isNew: "New",
    isNewTitle: "Listed in the last 14 days",
    fresh: "Just listed",
    revoked: "Revoked",
    network: "Network",
    noNetwork: "Offline",
    install: "Install",
    update: (version) => `Update to v${version}`,
    installed: "Installed",
    manage: "Manage",
    openOnIsland: "Open on island",
    openOnIslandTitle: (name) => `Expand the island and switch to “${name}”`,
    shotCount: (count) => `${count} screenshots`,
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
    tabs: { readme: "Overview", changelog: "Changelog", versions: "Versions" },
    noReadme: "The author didn't write a description.",
    noChangelog: "The author didn't write a changelog.",
    noVersions: "No version history.",
    reviewed: "Reviewed",
    urgent: "Urgent fix",
    current: "Installed",
    info: { version: "Version", size: "Size", updated: "Updated", requires: "Requires", platforms: "Platforms", license: "License" },
    requiresFuyu: (range) => `Fuyu ${range}`,
    official: "Fuyu team",
    likes: (count) => `👍 ${count}`,
    links: { repository: "Source", homepage: "Homepage", bugs: "Report an issue", funding: "Sponsor" },
    commands: "Commands & shortcuts",
    screenshots: "Screenshots",
    zoomShot: (index, total) => `View screenshot ${index} of ${total}`,
    viewer: { label: "Screenshot", prev: "Previous", next: "Next", close: "Close", position: (index, total) => `${index} / ${total}` },
    platforms: { win32: "Windows", darwin: "macOS", linux: "Linux" },
    close: "Close",
  },
  capabilities: {
    heading: "What it does",
    titles: {
      replaces: "Replaces built-in Fuyu services",
      network: "Connects to these addresses",
      runPrograms: "Runs programs on this computer",
      files: "Reads and writes files on this computer",
      nodeSensitive: "Uses low-level system features",
      nodeApis: "Uses Node modules",
    },
    usesModules: (list) => `Through the Node modules ${list}`,
    note: "Based on the plugin's manifest. Fuyu doesn't limit plugins to just these.",
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
    facts: { version: "Version", sha256: "SHA-256" },
    securityNote: "A plugin can do anything Fuyu can, such as reading and writing files, using the network or running programs, and Fuyu won't stop it. Only install plugins you trust.",
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
