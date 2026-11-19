import type { MarketCatalogPlugin, MarketCatalogSnapshot, MarketInspectedPackage, MarketPluginDetails, MarketVersionCandidate, PluginInstallConfirmation } from "@fuyu/plugin-services";

const loc = (zh: string, en: string) => ({ "zh-CN": zh, en });
const caps = (more: Partial<PluginInstallConfirmation> = {}): PluginInstallConfirmation => ({ unreviewed: false, network: [], nodeApis: [], provides: [], replaces: [], slots: ["island.page/v1"], ...more });
const candidate = (version: string, publishedAt: string, more: Partial<MarketVersionCandidate> = {}, confirmation: Partial<PluginInstallConfirmation> = {}): MarketVersionCandidate => ({
  version, sha256: "c".repeat(64), size: 86_016, publishedAt: `${publishedAt}T08:00:00Z`, ...more, confirmation: caps(confirmation),
});

const plugin = (name: string, names: [string, string], descriptions: [string, string], categories: string[], more: Partial<MarketCatalogPlugin> = {}): MarketCatalogPlugin => {
  const official = name.startsWith("@fuyu/");
  return {
    name, official, publisher: { github: official ? "TixXin" : name.split("/")[0].slice(1), official },
    displayName: loc(...names), description: loc(...descriptions), categories,
    installedVersion: null, enabled: false, source: null, revoked: false, blocked: null,
    install: null, manual: null, autoUpdate: null, ...more,
    firstPublishedAt: more.firstPublishedAt ?? (more.install ?? more.manual ?? more.autoUpdate)?.publishedAt ?? null,
  };
};

export const ICON_SVG = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="10" fill="#f59e0b"/><circle cx="14" cy="26" r="3" fill="#fff"/><path d="M11 18a11 11 0 0 1 11 11M11 11a18 18 0 0 1 18 18" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/></svg>')}`;
export const BROKEN_ICON = "data:image/svg+xml,not-an-image";

const shot = (fill: string, label: string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200"><rect width="320" height="200" fill="${fill}"/><rect x="60" y="24" width="200" height="34" rx="17" fill="#111"/><text x="160" y="47" font-size="16" text-anchor="middle" fill="#fff" font-family="sans-serif">${label}</text><rect x="40" y="80" width="240" height="96" rx="14" fill="#fff" opacity="0.85"/></svg>`)}`;
export const RSS_SHOTS = [
  { url: shot("#f59e0b", "RSS"), caption: loc("收起条上滚动的新标题", "Headlines scrolling on the bar") },
  { url: shot("#fb923c", "Feeds"), caption: loc("展开后的文章列表", "Article list when expanded") },
  { url: shot("#fdba74", "OPML") },
];
export const WEATHER_SHOTS = [{ url: shot("#38bdf8", "18°"), caption: loc("岛上的天气页", "The weather page on the island") }];

const installed = (version: string): Partial<MarketCatalogPlugin> => ({ installedVersion: version, enabled: true, source: "market" });

export const MARKET_PLUGINS: MarketCatalogPlugin[] = [
  plugin("@fuyu/rss", ["RSS 订阅", "RSS reader"], ["订阅博客和新闻，有新文章时在收起条上滚动标题，点一下打开", "Follow blogs and news; new headlines scroll on the collapsed bar, click to open"], ["information"],
    { icon: ICON_SVG, screenshots: RSS_SHOTS, install: candidate("1.5.0", "2026-11-12", {}, { official: true, network: ["*"], slots: ["collapsed.center/v1", "island.page/v1"] }) }),
  plugin("@fuyu/weather", ["天气", "Weather"], ["收起条上显示当前天气，下雨前半小时提醒你带伞", "Shows the weather on the collapsed bar and reminds you to take an umbrella before rain"], ["information"],
    { ...installed("1.2.0"), icon: BROKEN_ICON, screenshots: WEATHER_SHOTS, install: candidate("1.2.0", "2026-11-02", {}, { official: true, network: ["api.open-meteo.com"] }) }),
  plugin("@fuyu/github-notify", ["GitHub 通知", "GitHub notifications"], ["有人提到你、请你审查或 CI 失败时，在岛上弹一条提醒", "Pops an island alert when you're mentioned, asked to review, or CI fails"], ["developer"],
    { ...installed("2.0.1"), install: candidate("2.1.0", "2026-11-17"), autoUpdate: candidate("2.1.0", "2026-11-17", { urgent: true }, { official: true, network: ["api.github.com", "gist.github.com"], slots: ["notice/v1"] }) }),
  plugin("@fuyu/page-summary", ["网页摘要", "Page summary"], ["复制一个链接，岛上给出三句话的摘要，可以存进笔记", "Copy a link and the island gives a three-sentence summary you can save to notes"], ["ai", "productivity"],
    { install: candidate("0.9.3", "2026-11-10", {}, { official: true, network: ["api.openai.com"] }) }),
  plugin("@lin-dev/pomo-stats", ["专注统计", "Focus stats"], ["统计每天的番茄钟和专注时长，周日给你一份小结", "Tracks daily pomodoros and focus time, with a recap every Sunday"], ["productivity", "todos"],
    { ...installed("0.4.2"), manual: candidate("0.5.0", "2026-11-15", { trustChange: "unendorsed-key" }, { trustChange: "unendorsed-key", provides: ["focus-stats/v1"] }) }),
  plugin("@ryo/clip-sync", ["剪贴板跨设备", "Clipboard sync"], ["在两台电脑之间同步剪贴板，端到端加密", "Syncs the clipboard between two computers, end-to-end encrypted"], ["productivity"],
    { install: candidate("1.1.0", "2026-11-18", { fresh: true }, { network: ["relay.clipsync.dev"], nodeApis: ["node:fs", "node:crypto"], slots: ["collapsed.right/v1"], requiredPlugins: ["@fuyu/devices"] }) }),
  plugin("@tara/linear", ["Linear 任务", "Linear issues"], ["把分给你的 Linear 任务同步进待办，状态变了在岛上提醒", "Syncs Linear issues assigned to you into to-dos and alerts you on status changes"], ["developer", "todos"],
    { install: candidate("0.6.0", "2026-11-05", {}, { network: ["api.linear.app"], provides: ["linear/v1"] }) }),
  plugin("@nori/focus-sounds", ["白噪音", "Focus sounds"], ["雨声、咖啡馆、篝火，专注时在岛上点一下就放", "Rain, café and campfire sounds, one click on the island while you focus"], ["productivity", "media"],
    { install: candidate("1.3.2", "2026-11-01") }),
  plugin("@moe/pet-skins", ["宠物皮肤包", "Pet skins"], ["给收起条中间的小宠物换 12 套新造型", "Twelve new looks for the pet in the middle of the collapsed bar"], ["appearance"],
    { install: candidate("0.2.0", "2026-11-18", { fresh: true }, { slots: [] }) }),
  plugin("@kai/vscode-status", ["VS Code 状态", "VS Code status"], ["在岛上显示 VS Code 里正在调试、正在跑测试的状态", "Shows what VS Code is debugging or testing right on the island"], ["developer"],
    { blocked: { reason: "engines", range: ">=0.40.0" } }),
  plugin("@mio/focus-sync", ["专注模式同步", "Focus mode sync"], ["系统专注模式打开时，岛上自动免打扰", "Turns on island do-not-disturb when the system Focus mode is on"], ["productivity"],
    { blocked: { reason: "platform" } }),
  plugin("@fuyu/devices", ["设备配对", "Device pairing"], ["让两台装了浮屿的电脑互相认出来，给同步类插件用", "Lets two computers running Fuyu recognize each other, for sync plugins"], ["utilities"],
    { install: candidate("1.0.0", "2026-10-20", {}, { official: true, provides: ["devices/v1"], slots: [] }) }),
];

export const MARKET_INSTALLED: MarketCatalogSnapshot["installed"] = [
  { id: "@fuyu/weather", version: "1.2.0", source: "market", enabled: true, reach: { slots: ["island.page/v1", "island.collapsed/v1"], services: [], config: true } },
  { id: "@fuyu/github-notify", version: "2.0.1", source: "market", enabled: true, reach: { slots: [], services: ["messages/v1"], config: true } },
  { id: "@lin-dev/pomo-stats", version: "0.4.2", source: "market", enabled: true, reach: { slots: ["island.page/v1"], services: [], config: false } },
];

export const UPDATED_AT = new Date(2026, 10, 18, 20, 14).getTime();

export const marketFixture = (more: Partial<MarketCatalogSnapshot> = {}): MarketCatalogSnapshot => ({
  plugins: MARKET_PLUGINS, installed: MARKET_INSTALLED, updatedAt: UPDATED_AT, manualAllowed: false, error: null, ...more,
});

export const RSS_DETAILS: MarketPluginDetails = {
  name: "@fuyu/rss", displayName: loc("RSS 订阅", "RSS reader"), description: loc("订阅博客和新闻", "Follow blogs and news"),
  official: true, publisherName: "TixXin", author: "TixXin", license: "MIT",
  homepage: "https://fuyu.app/plugins/rss", repository: "https://github.com/TixXin/fuyu-plugins", bugs: "https://github.com/TixXin/fuyu-plugins/issues", funding: null,
  keywords: ["rss", "news"], categories: ["information"], platforms: ["win32", "darwin"], preview: false, likes: 212,
  installedVersion: null, latestVersion: "1.5.0",
  readme: "### 能做什么 / What it does\n- 添加任意 RSS / Atom 订阅源，或从 OPML 导入 · Add any RSS/Atom feed or import OPML\n- 有新文章时在收起条上滚动标题 · New headlines scroll on the collapsed bar\n\n### 隐私 / Privacy\n只连接你添加的订阅源地址 · It only connects to the feeds you add.",
  changelog: "### 1.5.0\n- 支持 OPML 导入导出 · OPML import and export\n\n### 1.4.2\n- 收起条滚动速度可调 · Adjustable scroll speed",
  screenshots: [
    { url: "https://plugins.fuyu.test/rss/bar.png", caption: loc("收起条上滚动的新标题", "Headlines scrolling on the bar") },
    { url: "https://plugins.fuyu.test/rss/list.png", caption: loc("展开后的文章列表", "Article list when expanded") },
    { url: "https://plugins.fuyu.test/rss/feeds.png", caption: loc("订阅源管理", "Managing feeds") },
  ],
  commands: [{ id: "refresh", title: loc("刷新订阅", "Refresh feeds"), keybinding: "Ctrl+Alt+R" }],
  slots: ["collapsed.center/v1", "island.page/v1"], provides: [], replaces: [], network: ["*"], nodeApis: [], requires: {},
  versions: [
    { version: "1.5.0", publishedAt: "2026-11-12T08:00:00Z", size: 86_016, reviewed: true, urgent: false, enginesFuyu: ">=0.38.0" },
    { version: "1.4.2", publishedAt: "2026-10-30T08:00:00Z", size: 82_944, reviewed: true, urgent: true, enginesFuyu: ">=0.38.0" },
    { version: "1.4.0", publishedAt: "2026-10-21T08:00:00Z", size: 81_920, reviewed: true, urgent: false, enginesFuyu: null },
  ],
};

export const TOOLBOX_PACKAGE: MarketInspectedPackage = {
  id: "my-toolbox", version: "0.2.0", sha256: "3e9b".padEnd(60, "0") + "a07c",
  confirmation: caps({ unreviewed: true, displayName: loc("我的小工具箱", "My toolbox"), description: loc("从本地 .fuyu 文件装的插件", "A plugin installed from a local .fuyu file"), nodeApis: ["node:child_process"] }),
};
