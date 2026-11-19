import { mockIPC } from "@tauri-apps/api/mocks";
import { commandsV1, marketV1, pluginConfigV1, pluginWindowsV1, type CommandItem, type MarketCatalogPlugin, type MarketInspectedPackage, type MarketPluginDetails, type MarketVersionCandidate, type PluginConfigValues, type PluginWindowRules } from "@fuyu/plugin-services";
import { LOCALE_STORAGE_KEY } from "../../src/i18n";
import type { HostNodeStatus } from "../../src/features/plugin-kernel/api";
import type { HostInfoV3, PluginStatusV3 } from "../../src/windows/settings/usePluginHostStatus";

export const locale = location.pathname.includes("-en") ? "en" : "zh-CN";
const savedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
localStorage.setItem(LOCALE_STORAGE_KEY, locale);
window.addEventListener("beforeunload", () => {
  if (savedLocale === null) localStorage.removeItem(LOCALE_STORAGE_KEY);
  else localStorage.setItem(LOCALE_STORAGE_KEY, savedLocale);
});
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, isTauri: true });

export const MB = 1024 * 1024;
const catalog = (await import("../../src/features/builtins.json")).default as { plugins: { id: string; kind: "builtin" | "essential" }[] };
export const ipc = {
  builtins: catalog.plugins.map(({ id, kind }) => ({ id, kind, enabled: id !== "todos", background: [] as { name: string; registered: boolean; running: boolean }[], config: {} })),
  calls: [] as string[],
  migrationPending: false,
  pendingPackage: null as { fileName: string; base64: string } | null,
  node: null as HostNodeStatus | null,
};

const migration = () => ({
  official: [
    { v2Id: "dev.focusd.weather", v3Id: "@fuyu/weather", title: { "zh-CN": "天气", en: "Weather" }, enabledInV2: true, configMigrated: true, installedInV3: true, registeredInYml: true },
    { v2Id: "dev.focusd.countdown", v3Id: "@fuyu/countdown", title: { "zh-CN": "倒数日", en: "Countdown" }, enabledInV2: true, configMigrated: false, installedInV3: false, registeredInYml: false },
  ],
  other: [{ id: "com.example.custom", title: { "zh-CN": "自定义小插件", en: "Custom gadget" }, enabledInV2: true }],
  islandPending: false,
  settingsPending: ipc.migrationPending,
});

mockIPC((command, payload) => {
  const args = (payload ?? {}) as Record<string, unknown>;
  if (command === "get_builtin_plugins") return ipc.builtins;
  if (command === "set_builtin_plugin_enabled") {
    ipc.calls.push(`builtin:${String(args.id)}=${String(args.enabled)}`);
    ipc.builtins = ipc.builtins.map((plugin) => (plugin.id === args.id ? { ...plugin, enabled: Boolean(args.enabled) } : plugin));
    return ipc.builtins;
  }
  if (command === "get_plugin_host_memory") return { pid: 4242, bytes: 25.2 * MB, measure: "private-working-set" };
  if (command === "exit_plugin_safe_mode") return (ipc.calls.push("leave-safe"), true);
  if (command === "get_plugin_host_connection") return { enabled: true, port: 1, token: "t", generation: 1, safeMode: null, node: ipc.node };
  if (command === "retry_plugin_host_node") return (ipc.calls.push("retry-node"), true);
  if (command === "get_platform_support") return { os: "windows", unsupported: [], devBuild: false };
  if (command === "get_v2_plugin_migration") return migration();
  if (command === "dismiss_v2_plugin_migration") return (ipc.calls.push(`dismiss:${String(args.target)}`), ipc.migrationPending = false, migration());
  if (command === "take_pending_plugin_package") {
    const taken = ipc.pendingPackage;
    ipc.pendingPackage = null;
    return taken;
  }
  if (command === "plugin:opener|open_url") return (ipc.calls.push(`open:${String(args.url)}`), null);
  return null;
});

const { windowServices } = await import("../../src/features/plugin-kernel/services");
export { windowServices };

const loc = (zh: string, en: string) => ({ "zh-CN": zh, en });
export const REASON = {
  shady: loc("会把剪贴板内容上传到作者的服务器", "Uploads clipboard contents to the author's server"),
  sketchy: loc("0.5.0 在部分电脑上会反复重连，占用网络", "0.5.0 keeps reconnecting on some computers and eats bandwidth"),
};
const candidate = (version: string, official: boolean, fresh = false): MarketVersionCandidate => ({
  version, sha256: "a".repeat(64), size: 2048, publishedAt: "2026-11-18T00:00:00Z", fresh,
  confirmation: { unreviewed: false, official, displayName: loc("", ""), description: loc("", ""), network: official ? ["api.open-meteo.com"] : [], nodeApis: official ? [] : ["node:crypto"], provides: [], replaces: [], slots: ["island.page/v1"] },
} as MarketVersionCandidate);
const entry = (name: string, zh: string, en: string, dz: string, de: string, more: Partial<MarketCatalogPlugin> = {}): MarketCatalogPlugin => {
  const official = name.startsWith("@fuyu/");
  return {
    name, official, publisher: { github: official ? "TixXin" : name.split("/")[0].slice(1), official },
    displayName: loc(zh, en), description: loc(dz, de), categories: ["utilities"],
    installedVersion: null, enabled: false, source: null, revoked: false,
    install: candidate("1.0.0", official), manual: null, autoUpdate: null, ...more,
  } as MarketCatalogPlugin;
};

export const market = {
  manualAllowed: false,
  calls: [] as string[],
  installed: { "@fuyu/weather": "1.2.0", "@fuyu/pomodoro": "1.0.0", "@someone/clock": "2.0.0", "@someone/shady": "0.3.0" } as Record<string, string>,
  revokeOnEnable: null as string | null,
  revocationCases: false,
  details: {} as Record<string, MarketPluginDetails>,
  inspected: null as MarketInspectedPackage | null,
};
const marketPlugins = (): MarketCatalogPlugin[] => {
  const with_ = (plugin: MarketCatalogPlugin) => {
    const installedVersion = market.installed[plugin.name] ?? null;
    return { ...plugin, installedVersion, enabled: Boolean(installedVersion), source: installedVersion ? "market" as const : null };
  };
  const cases = market.revocationCases ? [
    entry("@someone/sketchy", "剪贴板同步", "Clipboard sync", "在几台电脑之间同步剪贴板", "Syncs the clipboard between computers", { install: candidate("0.5.1", false), manual: candidate("0.5.1", false), revocation: { level: "warn", reasons: [REASON.sketchy] } }),
    entry("@someone/translator", "划词翻译", "Selection translator", "选中文字就翻译", "Translates the text you select", {
      install: candidate("1.1.0", false), manual: candidate("1.1.0", false),
      autoUpdateHeld: { version: "1.1.0", reason: "new-capabilities", newCapabilities: { network: ["api.deepl.com"], nodeApis: ["node:child_process"], replaces: ["translation/v1"] } },
    }),
  ] : [];
  return [
    entry("@fuyu/weather", "天气", "Weather", "在岛上看实时气温和逐小时预报", "Live temperature and an hourly forecast on the island", { install: candidate("1.2.0", true) }),
    entry("@fuyu/pomodoro", "番茄钟", "Pomodoro", "专注 25 分钟，休息 5 分钟", "Focus for 25 minutes, rest for 5", { install: candidate("1.1.0", true), autoUpdate: candidate("1.1.0", true) }),
    entry("@someone/clock", "世界时钟", "World clock", "收起时显示另一个时区的时间", "Shows another time zone while collapsed", { install: candidate("2.0.0", false) }),
    entry("@someone/shady", "可疑插件", "Shady plugin", "已被市场撤下", "Pulled from the market", { revoked: true, revocation: { level: "disable", reasons: [REASON.shady] } }),
    entry("@someone/stocks", "股票行情", "Stock ticker", "自选股涨跌一眼看到", "Your watchlist at a glance", { install: candidate("1.0.0", false) }),
    entry("@fuyu/countdown", "倒数日", "Countdown", "离重要的日子还有几天", "Days left until the dates that matter"),
    entry("@someone/notes", "便签", "Sticky notes", "随手记一句", "Jot a line down", { install: candidate("0.9.0", false, true) }),
    { ...entry("@someone/old", "旧插件", "Old plugin", "版本不够", "Too old"), install: null, blocked: { reason: "engines" as const, range: ">=9.0.0" } },
    ...cases,
  ].map(with_);
};
export const marketSnapshot = () => ({ plugins: marketPlugins(), installed: [], updatedAt: null, manualAllowed: market.manualAllowed, error: null });
let emitMarket: () => void = () => {};
const marketProvider = windowServices.provide(marketV1, {
  catalog: () => marketSnapshot(),
  refresh: () => (market.calls.push("refresh"), marketSnapshot()),
  details: ({ name }) => market.details[name] ?? ({
    name, displayName: loc("天气", "Weather"), description: loc("天气预报", "Forecast"),
    official: name.startsWith("@fuyu/"), publisherName: "TixXin", author: "TixXin", license: "MIT",
    homepage: null, repository: "https://github.com/TixXin/fuyu-plugins", bugs: null, funding: null,
    keywords: [], categories: ["utilities"], platforms: ["win32", "darwin"], preview: false, likes: 42,
    installedVersion: market.installed[name] ?? null, latestVersion: "1.2.0",
    readme: "### Hourly forecast\nLive temperature on the island.", changelog: "### 1.2.0\nFaster refresh.",
    screenshots: [], commands: [{ id: "refresh", title: loc("刷新天气", "Refresh weather"), keybinding: "Alt+W" }],
    slots: ["island.page/v1"], provides: [], replaces: [], network: ["api.open-meteo.com"], nodeApis: ["node:fs"], requires: {},
    versions: [{ version: "1.2.0", publishedAt: "2026-11-18T00:00:00Z", size: 2048, reviewed: true, urgent: false, enginesFuyu: ">=0.9.0" }],
  }),
  inspectPackage: () => (market.calls.push("inspect"), market.inspected ?? { id: "@me/gadget", version: "0.1.0", sha256: "b".repeat(64), source: "manual" as const, confirmation: { ...candidate("0.1.0", false).confirmation, unreviewed: true, displayName: loc("小工具", "Gadget") } }),
  installMarket: ({ name, version }) => {
    market.calls.push(`install:${name}@${version ?? ""}`);
    market.installed[name] = version ?? "1.0.0";
    emitMarket();
    return { id: name, version: version ?? "1.0.0", source: "market" as const, sha256: "a".repeat(64), confirmation: candidate("1.0.0", true).confirmation };
  },
  installFile: ({ expectedSha256 }) => (market.calls.push(`installFile:${expectedSha256 ?? ""}`), { id: "@me/gadget", version: "0.1.0", source: "manual" as const, sha256: "b".repeat(64), confirmation: candidate("0.1.0", false).confirmation }),
  setManualAllowed: ({ allowed }) => (market.manualAllowed = allowed, market.calls.push(`manual:${allowed}`), emitMarket(), { manualAllowed: allowed }),
  setEnabled: ({ id, enabled }) => {
    market.calls.push(`enabled:${id}=${enabled}`);
    if (enabled && id === market.revokeOnEnable) throw Object.assign(new Error(`${id} has been revoked and cannot be turned on`), { code: "revoked", data: { reasons: [REASON.shady] } });
    return { id, enabled };
  },
  uninstall: ({ id, removeData }) => (market.calls.push(`uninstall:${id}:${Boolean(removeData)}`), { id, removed: true as const }),
});
emitMarket = () => marketProvider.emit("changed", {});

const schema = {
  type: "object" as const,
  properties: {
    autoRefresh: { type: "boolean" as const, title: loc("自动刷新", "Auto refresh"), default: true },
    unit: { type: "string" as const, title: loc("单位", "Unit"), enum: ["celsius", "fahrenheit"], default: "celsius" },
  },
};
const defaults: PluginConfigValues = { autoRefresh: true, unit: "celsius" };
let values: PluginConfigValues = { ...defaults };
export const configCalls: string[] = [];
windowServices.provide(pluginConfigV1, {
  list: () => ({ items: [] }),
  get: ({ id }) => (id === "@fuyu/weather" ? { id, schema, values: { ...values }, defaults } : { id, schema: null, values: {}, defaults: {} }),
  set: ({ id, values: patch }) => (values = { ...values, ...patch }, configCalls.push(`set:${id}:${JSON.stringify(patch)}`), { id, schema, values: { ...values }, defaults }),
  reset: ({ id }) => (values = { ...defaults }, configCalls.push(`reset:${id}`), { id, schema, values: { ...values }, defaults }),
});
let rules: PluginWindowRules = { disallowAlwaysOnTop: false, disallowClickThrough: false, hideAll: false };
windowServices.provide(pluginWindowsV1, {
  getRules: () => ({ ...rules }),
  setRules: ({ id, ...patch }) => (rules = { ...rules, ...patch }, configCalls.push(`rules:${id}:${JSON.stringify(patch)}`), { ...rules }),
  list: () => ({ items: [] }),
});
const commands: CommandItem[] = [
  { pluginId: "@fuyu/weather", pluginName: loc("天气", "Weather"), id: "refresh", title: loc("刷新天气", "Refresh weather"), defaultKeybinding: "Alt+W", keybinding: "Alt+W", active: true, conflicts: [] },
  { pluginId: "@fuyu/weather", pluginName: loc("天气", "Weather"), id: "toggle-unit", title: loc("切换单位", "Switch unit"), defaultKeybinding: null, keybinding: null, active: true, conflicts: [] },
];
windowServices.provide(commandsV1, {
  list: () => ({ items: commands }),
  run: () => null,
  setKeybinding: () => ({ items: commands }),
});

const usage = (more: Partial<NonNullable<PluginStatusV3["usage"]>> = {}) => ({ cpuMs: 4.2, calls: 12, applyMs: 0.4, timers: 1, listeners: 2, services: 0, clients: 1, errors: 0, ...more });
export const PLUGIN = {
  weather: { id: "@fuyu/weather", name: "Weather", state: "running", kind: "third-party", source: "market", usage: usage({ cpuMs: 12.5, calls: 40 }) },
  clock: { id: "@someone/clock", name: "Clock", state: "running", kind: "third-party", source: "market", usage: usage() },
  gadget: { id: "@me/gadget", name: "Gadget", state: "disabled", kind: "third-party", source: "manual" },
  local: { id: "my-local-tool", name: "./my-local-tool/index.mjs", state: "running", kind: "third-party", source: "file", usage: usage() },
  hello: { id: "hello", name: "hello", state: "running", kind: "third-party", source: "dev", usage: usage() },
  counter: { id: "counter", name: "./counter.mjs", state: "running", kind: "builtin", usage: usage() },
  pomodoro: { id: "@fuyu/pomodoro", name: "Pomodoro", state: "running", kind: "third-party", source: "market", usage: usage() },
  feeds: { id: "@someone/feeds", name: "RSS feeds", state: "failed", kind: "third-party", source: "market", error: "TypeError: Cannot read properties of undefined (reading 'items')\n    at parse (feeds.mjs:42:17)\n    at refresh (feeds.mjs:12:3)", usage: usage({ errors: 1 }) },
  flaky: { id: "@someone/flaky-plugin-with-a-really-long-identifier-that-should-not-overflow", name: "Flaky", state: "auto-disabled", kind: "third-party", source: "market", blocked: { by: "errors", errors: 5, windowMs: 60000 }, lastError: { at: 1, text: "Error: flaky broke\n    at apply (flaky.mjs:3:11)" }, usage: usage({ errors: 5 }) },
  todoSync: { id: "@someone/todo-sync", name: "Todo sync", state: "waiting", kind: "third-party", source: "market", waitingFor: ["todos/v1"], usage: usage({ applyMs: null }) },
  shady: { id: "@someone/shady", name: "Shady", state: "disabled", kind: "third-party", source: "market" },
  sketchy: { id: "@someone/sketchy", name: "Clipboard sync", state: "running", kind: "third-party", source: "market", usage: usage() },
  translator: { id: "@someone/translator", name: "Translator", state: "running", kind: "third-party", source: "market", usage: usage() },
  linked: { id: "@me/linked", name: "Linked", state: "running", kind: "third-party", source: "manual", unreachableClients: ["island", "settings"], usage: usage() },
} satisfies Record<string, PluginStatusV3>;
export const NORMAL: PluginStatusV3[] = [PLUGIN.weather, PLUGIN.clock, PLUGIN.gadget, PLUGIN.local, PLUGIN.counter];
export const HOST: HostInfoV3 = { pid: 4242, node: "22.15.0", startedAt: Date.now() - 65_000, safe: null, dev: false, rssBytes: 42 * MB, heapUsedBytes: 9 * MB, cpuMs: 830 };
export const held = (plugin: PluginStatusV3): PluginStatusV3 => ({ ...plugin, state: plugin.state === "disabled" ? "disabled" : "safe-mode", blocked: { by: "safe-mode", mode: "third-party" } });
