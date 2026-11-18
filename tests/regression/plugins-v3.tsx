import { mockIPC } from "@tauri-apps/api/mocks";
import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles/tokens.css";
import "../../src/styles/fonts.css";
import { I18nProvider, LOCALE_STORAGE_KEY, TRANSLATIONS } from "../../src/i18n";
import { marketV1, pluginConfigV1, pluginWindowsV1, type MarketCatalogPlugin, type PluginConfigValues, type PluginWindowRules } from "@fuyu/plugin-services";
import type { HostNodeStatus } from "../../src/features/plugin-kernel/api";
import type { HostInfoV3, PluginHostConnector, PluginHostHandlers, PluginStatusV3 } from "../../src/windows/settings/usePluginHostStatus";

const savedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
const locale = new URLSearchParams(location.search).get("locale") === "en" ? "en" : "zh-CN";
localStorage.setItem(LOCALE_STORAGE_KEY, locale);
window.addEventListener("beforeunload", () => {
  if (savedLocale === null) localStorage.removeItem(LOCALE_STORAGE_KEY);
  else localStorage.setItem(LOCALE_STORAGE_KEY, savedLocale);
});
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, isTauri: true });

const MB = 1024 * 1024;
let memoryReply: { pid: number; bytes: number; measure: "private-working-set" | "phys-footprint" } | null = { pid: 4242, bytes: 25.2 * MB, measure: "private-working-set" };

let safeReply: { mode: "third-party" | "minimal"; cause: "variable" | "shift" | "failures"; failures: number } | null = { mode: "third-party", cause: "failures", failures: 2 };
let leaveCalls = 0;
let nodeReply: HostNodeStatus | null = null;
let retryCalls = 0;
const catalog = (await import("../../src/features/builtins.json")).default as { plugins: { id: string; kind: "builtin" | "essential" }[] };
let builtins = catalog.plugins.map(({ id, kind }) => ({ id, kind, enabled: id !== "clipboard", background: [] as { name: string; registered: boolean; running: boolean }[], config: {} }));
const switchCalls: { id: string; enabled: boolean }[] = [];
const migrationDismissCalls: string[] = [];
let migrationReply = {
  official: [
    { v2Id: "dev.focusd.weather", v3Id: "@fuyu/weather", title: { "zh-CN": "天气", en: "Weather" }, enabledInV2: true, configMigrated: true, installedInV3: false, registeredInYml: false },
    { v2Id: "dev.focusd.pomodoro", v3Id: "@fuyu/pomodoro", title: { "zh-CN": "番茄钟", en: "Pomodoro" }, enabledInV2: true, configMigrated: false, installedInV3: true, registeredInYml: true },
  ],
  other: [{ id: "com.example.custom", title: { "zh-CN": "自定义小插件", en: "Custom gadget" }, enabledInV2: true }],
  islandPending: false,
  settingsPending: true,
};

mockIPC((command, payload) => {
  if (command === "get_builtin_plugins") return builtins;
  if (command === "set_builtin_plugin_enabled") {
    const { id, enabled } = payload as { id: string; enabled: boolean };
    switchCalls.push({ id, enabled });
    builtins = builtins.map((plugin) => (plugin.id === id ? { ...plugin, enabled } : plugin));
    return builtins;
  }
  if (command === "get_plugin_host_memory") return memoryReply;
  if (command === "exit_plugin_safe_mode") return (leaveCalls += 1, true);
  if (command === "get_plugin_host_connection") return { enabled: true, port: 1, token: "t", generation: 1, safeMode: safeReply, node: nodeReply };
  if (command === "retry_plugin_host_node") return (retryCalls += 1, nodeReply = { state: "checking" }, true);
  if (command === "get_platform_support") return { os: "windows", unsupported: [], devBuild: true };
  if (command === "get_v2_plugin_migration") return migrationReply;
  if (command === "dismiss_v2_plugin_migration") {
    const { target } = payload as { target: string };
    migrationDismissCalls.push(target);
    migrationReply = { ...migrationReply, settingsPending: false };
    return migrationReply;
  }
  if (command === "take_pending_plugin_package") return null;
  return null;
});

const { SettingsSidebar } = await import("../../src/windows/settings/SettingsSidebar");
await import("../../src/windows/settings/slots/categories");
const { PluginsV3SettingsPage } = await import("../../src/windows/settings/PluginsV3SettingsPage");
const { windowServices } = await import("../../src/features/plugin-kernel/services");
const { windowSlots } = await import("../../src/features/plugin-kernel/slots");
const { NODE_EVERY_MS } = await import("../../src/windows/settings/usePluginHostNode");

let manualAllowed = false;
let weatherInstalled: string | null = null;
const marketCalls: string[] = [];
const makeMarketEntry = (name: string, official: boolean, fresh: boolean, zh: string, en: string, network: string[], slots: string[]): MarketCatalogPlugin => {
  const confirmation = { unreviewed: false, official, displayName: { "zh-CN": zh, en }, description: { "zh-CN": zh, en }, network, nodeApis: official ? [] : ["node:crypto"], provides: official ? [] : ["clock/v1"], replaces: [], slots };
  const installedVersion = name === "@fuyu/weather" ? weatherInstalled : null;
  return {
    name, official, publisher: { github: official ? "TixXin" : "someone", official },
    displayName: { "zh-CN": zh, en }, description: { "zh-CN": zh, en }, categories: ["utilities"],
    installedVersion, enabled: Boolean(installedVersion), source: installedVersion ? "market" : null, revoked: false,
    install: { version: "1.0.0", sha256: "a".repeat(64), size: 2048, publishedAt: "2026-11-18T00:00:00Z", fresh, confirmation },
    manual: null, autoUpdate: null,
  };
};
const marketSnapshot = () => ({
  plugins: [
    makeMarketEntry("@fuyu/weather", true, false, "天气", "Weather", ["api.open-meteo.com"], ["island.page/v1"]),
    makeMarketEntry("@someone/clock", false, true, "时钟", "Clock", [], ["island.collapsed/v1"]),
  ],
  installed: [], updatedAt: null, manualAllowed, error: null,
});
let emitMarketChanged: (() => void) | undefined;
const marketProvider = windowServices.provide(marketV1, {
  catalog: () => marketSnapshot(),
  refresh: () => (marketCalls.push("refresh"), marketSnapshot()),
  details: ({ name }) => ({
    name, displayName: { "zh-CN": "天气", en: "Weather" }, description: { "zh-CN": "天气预报", en: "Forecast" },
    official: name === "@fuyu/weather", publisherName: "TixXin", author: "TixXin", license: "MIT",
    homepage: "https://github.com/TixXin/fuyu-plugins", repository: "https://github.com/TixXin/fuyu-plugins", bugs: null, funding: null,
    keywords: ["weather"], categories: ["utilities"], platforms: ["win32", "darwin"], preview: false, likes: 42,
    installedVersion: name === "@fuyu/weather" ? weatherInstalled : null, latestVersion: "1.0.0",
    readme: "### Hourly forecast\nLive temperature on the island.", changelog: "### 1.0.0\nInitial release.",
    screenshots: [], commands: [{ id: "refresh", title: { "zh-CN": "刷新天气", en: "Refresh weather" }, keybinding: "Alt+W" }],
    slots: ["island.page/v1"], provides: [], replaces: [], network: ["api.open-meteo.com"], nodeApis: [], requires: {},
    versions: [{ version: "1.0.0", publishedAt: "2026-11-18T00:00:00Z", size: 2048, reviewed: true, urgent: false, enginesFuyu: ">=0.9.0" }],
  }),
  inspectPackage: () => { throw new Error("unexpected inspectPackage"); },
  installMarket: ({ name, version }) => {
    marketCalls.push(`installMarket:${name}@${version ?? ""}`);
    if (name === "@fuyu/weather") weatherInstalled = version ?? "1.0.0";
    emitMarketChanged?.();
    return { id: name, version: version ?? "1.0.0", source: "market" as const, sha256: "a".repeat(64), confirmation: marketSnapshot().plugins[0].install!.confirmation };
  },
  installFile: () => { throw new Error("unexpected installFile"); },
  setManualAllowed: ({ allowed }) => (manualAllowed = allowed, marketCalls.push(`manual:${allowed}`), emitMarketChanged?.(), { manualAllowed }),
  setEnabled: ({ id, enabled }) => (marketCalls.push(`setEnabled:${id}=${enabled}`), { id, enabled }),
  uninstall: ({ id, removeData }) => (marketCalls.push(`uninstall:${id}:${Boolean(removeData)}`), { id, removed: true as const }),
});
emitMarketChanged = () => { marketProvider.emit("changed", {}); };

const weatherSchema = {
  type: "object" as const,
  properties: {
    autoRefresh: { type: "boolean" as const, title: { "zh-CN": "自动刷新", en: "Auto refresh" }, default: true },
    unit: { type: "string" as const, title: { "zh-CN": "单位", en: "Unit" }, enum: ["celsius", "fahrenheit"], default: "celsius" },
  },
};
const weatherDefaults: PluginConfigValues = { autoRefresh: true, unit: "celsius" };
let weatherConfig: PluginConfigValues = { ...weatherDefaults };
const configCalls: string[] = [];
windowServices.provide(pluginConfigV1, {
  list: () => ({ items: [] }),
  get: ({ id }) => (id === "@fuyu/weather" ? { id, schema: weatherSchema, values: { ...weatherConfig }, defaults: weatherDefaults } : { id, schema: null, values: {}, defaults: {} }),
  set: ({ id, values }) => (weatherConfig = { ...weatherConfig, ...values }, configCalls.push(`set:${id}:${JSON.stringify(values)}`), { id, schema: weatherSchema, values: { ...weatherConfig }, defaults: weatherDefaults }),
  reset: ({ id }) => (weatherConfig = { ...weatherDefaults }, configCalls.push(`reset:${id}`), { id, schema: weatherSchema, values: { ...weatherConfig }, defaults: weatherDefaults }),
});
let weatherRules: PluginWindowRules = { disallowAlwaysOnTop: false, disallowClickThrough: false, hideAll: false };
const ruleCalls: string[] = [];
windowServices.provide(pluginWindowsV1, {
  getRules: () => ({ ...weatherRules }),
  setRules: ({ id, ...patch }) => (weatherRules = { ...weatherRules, ...patch }, ruleCalls.push(`rules:${id}:${JSON.stringify(patch)}`), { ...weatherRules }),
  list: () => ({ items: [] }),
});

const text = TRANSLATIONS[locale].settings.pluginsV3;
const usage = (more: Partial<NonNullable<PluginStatusV3["usage"]>> = {}) => ({ cpuMs: 0, calls: 0, applyMs: 0.4, timers: 0, listeners: 0, services: 0, clients: 0, errors: 0, ...more });
const PLUGINS: PluginStatusV3[] = [
  { id: "counter", name: "./counter.mjs", state: "running", kind: "builtin", usage: usage({ cpuMs: 12.5, calls: 40, timers: 2, listeners: 3, services: 1, clients: 1 }) },
  { id: "reader", name: "./reader.mjs", state: "waiting", kind: "essential", waitingFor: ["store", "todos"], usage: usage({ applyMs: null }) },
  { id: "broken", name: "./broken.mjs", state: "failed", kind: "third-party", error: "Error: broken on purpose", usage: usage({ errors: 1 }) },
  { id: "off", name: "./off.mjs", state: "disabled" },
  { id: "flaky-plugin-with-a-really-long-identifier-that-should-not-overflow", name: "./flaky.mjs", state: "auto-disabled", kind: "third-party", blocked: { by: "errors", errors: 5, windowMs: 60000 }, reason: "5 errors within 60 s; it stays off until the host restarts. Last error: Error: flaky broke", lastError: { at: 1, text: "Error: flaky broke\n    at apply (flaky.mjs:3:11)" }, usage: usage({ errors: 5 }) },
  { id: "held", name: "./held.mjs", state: "safe-mode", kind: "third-party", blocked: { by: "safe-mode", mode: "third-party" }, reason: "safe mode \"third-party\" keeps only essential and builtin plugins; this one is third-party", usage: usage({ applyMs: null }) },
  { id: "noisy", name: "./noisy.mjs", state: "running", kind: "third-party", lastError: { at: 2, text: "Error: once" }, usage: usage({ errors: 1, cpuMs: 1500 }) },
];
const HOST: HostInfoV3 = { pid: 4242, node: "26.12.0", startedAt: Date.now() - 65_000, safe: "third-party", dev: true, rssBytes: 42 * 1024 * 1024, heapUsedBytes: 9 * 1024 * 1024, cpuMs: 830 };

function fakeHost() {
  const fake = { handlers: null as PluginHostHandlers | null, open: 0 };
  const connect: PluginHostConnector = (given) => {
    fake.handlers = given;
    fake.open += 1;
    return { close: () => void (fake.open -= 1) };
  };
  return { fake, connect };
}
const main = fakeHost();
const side = fakeHost();

const messages: string[] = [];
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
  messages.push(`PASS ${message}`);
};
const results = document.getElementById("results")!;
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 60)); });
const nextNodeRead = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, NODE_EVERY_MS + 100)); });
const page = document.getElementById("page")!;
const card = (id: string) => page.querySelector<HTMLElement>(`.plugins-v3__plugin[data-plugin='${id}']`);
const stateText = (id: string) => card(id)?.querySelector(".plugins-v3__state")?.textContent;
const send = (fn: (given: PluginHostHandlers) => void) => act(async () => { fn(main.fake.handlers!); });

try {
  await act(async () => {
    createRoot(document.getElementById("sidebar")!).render(
      <StrictMode><I18nProvider><SettingsSidebar category="pluginsV3" onCategoryChange={() => {}} /></I18nProvider></StrictMode>,
    );
    createRoot(page).render(<StrictMode><I18nProvider><PluginsV3SettingsPage connect={main.connect} /></I18nProvider></StrictMode>);
  });
  const narrowRoot = createRoot(document.getElementById("narrow")!);
  await act(async () => {
    narrowRoot.render(<StrictMode><I18nProvider><PluginsV3SettingsPage connect={side.connect} /></I18nProvider></StrictMode>);
  });
  await settle();

  check(document.querySelector(".settings-sidebar__item[data-category='pluginsV3']"), "With the v3 switch on, the sidebar lists the Plugins (v3) page");
  const builtinRow = (id: string) => page.querySelector<HTMLElement>(`.plugins-v3__builtin[data-builtin='${id}']`);
  const builtinSwitch = (id: string) => builtinRow(id)?.querySelector<HTMLInputElement>("input");
  check(page.querySelectorAll(".plugins-v3__builtin").length === 22 && catalog.plugins.every(({ id }) => builtinRow(id)?.textContent?.includes(text.builtinNames[id as keyof typeof text.builtinNames])), "The page lists all 22 built-in plugins by name, before the host has answered");
  check(builtinRow("clipboard")?.dataset.enabled === "false" && builtinSwitch("clipboard")?.checked === false && builtinSwitch("timer")?.checked === true, "Each switch shows what plugins.yml says");
  check(builtinSwitch("updater")?.disabled && builtinRow("updater")!.textContent!.includes(text.essentialNote), "The updater is essential: its switch cannot be turned off");
  check(windowSlots("settings").disabledOwners().join() === "clipboard" && windowSlots("island").disabledOwners().join() === "clipboard", "Both windows hide the slot items of a switched-off plugin");
  await act(async () => builtinSwitch("timer")!.click());
  await settle();
  check(switchCalls[switchCalls.length - 1]?.id === "timer" && switchCalls[switchCalls.length - 1]?.enabled === false && builtinSwitch("timer")?.checked === false, "Switching a plugin off asks Rust and shows the new state");
  check(windowSlots("island").disabledOwners().sort().join() === "clipboard,timer", "and its slot items drop out");
  await act(async () => builtinSwitch("timer")!.click());
  await settle();
  check(builtinSwitch("timer")?.checked === true && windowSlots("island").disabledOwners().join() === "clipboard", "Switching it back on brings them back");
  check(page.querySelector("[data-connection='connecting']")?.textContent === text.connection.connecting, "Before the host answers the page says it is connecting");
  check(page.textContent?.includes(text.waitingHost), "and that plugins show up once it is connected");
  const nodeRow = () => page.querySelector<HTMLElement>(".plugins-v3__node");
  check(!nodeRow(), "With Node found there is no download row");
  nodeReply = { state: "downloading", downloaded: 12 * MB, total: 30 * MB };
  await nextNodeRead();
  check(nodeRow()?.querySelector("[data-node='downloading']")?.textContent === text.node.downloading && nodeRow()!.textContent!.includes(text.node.progress("12.0", "30.0")), "Without Node on the computer the host group shows the download and how far it got");
  nodeReply = { state: "failed", error: "Node 22.15 or newer was not found; all 3 download sources failed" };
  await nextNodeRead();
  const retryButton = () => nodeRow()?.querySelector<HTMLButtonElement>(".plugins-v3__retry");
  check(nodeRow()?.querySelector("[data-node='failed']")?.textContent === text.node.failed && nodeRow()!.textContent!.includes("all 3 download sources failed") && retryButton()?.textContent === text.node.retry, "A failed download says why and offers to retry");
  await act(async () => retryButton()!.click());
  await settle();
  check(retryCalls === 1 && !nodeRow(), "Retrying asks Fuyu once and the failure goes away while it looks again");
  HOST.startedAt = Date.now() - 65_000;

  await send((given) => {
    given.onState("open");
    given.onSnapshot({ plugins: PLUGINS, host: HOST });
  });
  check(page.querySelector("[data-connection='open']")?.textContent === text.connection.open, "Once connected it says so");
  nodeReply = { state: "ready" };
  check(!nodeRow(), "and the download row is gone");
  await settle();
  const memoryValue = () => page.querySelector<HTMLElement>(".plugins-v3__value[data-measure]");
  check(page.textContent?.includes(text.hostDetail(4242, "26.12.0")), "The host row shows its process and Node version");
  check(memoryValue()?.textContent === "25.2 MB" && memoryValue()?.dataset.measure === "private-working-set" && !page.textContent?.includes("42.0 MB"), "Memory is the private working set Fuyu reads from the host process, not the host's own resident size");
  check(page.textContent?.includes(text.memoryTitles["private-working-set"]) && page.textContent?.includes(text.memoryNotes["private-working-set"]), "and the label says which measure it is");
  check(page.textContent?.includes(text.safeModes["third-party"]) && page.textContent?.includes(text.devMode), "Safe mode and dev mode are shown when the host runs in them");
  const leaveButton = () => page.querySelector<HTMLButtonElement>(".plugins-v3__leave");
  check(page.textContent?.includes(text.safeCauses.failures(2)), "The safe mode row says it came from two failed starts in a row");
  check(leaveButton()?.textContent === text.leaveSafeMode, "and offers to leave safe mode");
  await act(async () => leaveButton()!.click());
  await settle();
  check(leaveCalls === 1 && leaveButton()?.disabled, "Leaving asks Fuyu once and the button waits for the host to restart");

  check(stateText("counter") === text.states.running && card("counter")!.textContent!.includes("12.5 ms"), "A running plugin shows its state and CPU");
  const counterUsage = [...card("counter")!.querySelectorAll("dd")].map((value) => value.textContent);
  check(counterUsage.join("|") === "12.5 ms|0.40 ms|2|3|1|1|0", "and its start time, timers, listeners, services, UI files and errors");
  check(stateText("reader") === text.states.waiting && card("reader")!.textContent!.includes(text.waitingFor("store, todos")), "A waiting plugin names the services it waits for");
  check(card("reader")!.textContent!.includes("–"), "A plugin that has not started shows no start time");
  check(stateText("broken") === text.states.failed && card("broken")!.textContent!.includes("broken on purpose"), "A failed plugin shows why");
  check(stateText("off") === text.states.disabled && !card("off")!.querySelector(".plugins-v3__usage"), "A plugin switched off in plugins.yml shows as off");
  const flaky = card("flaky-plugin-with-a-really-long-identifier-that-should-not-overflow")!;
  check(flaky.dataset.state === "auto-disabled" && flaky.textContent!.includes(text.autoDisabled(5, 60)) && flaky.querySelector(".plugins-v3__last-error"), "A plugin the host turned off says why in the window's language, with its last error at hand");
  check(stateText("held") === text.states["safe-mode"] && card("held")!.textContent!.includes(text.heldBySafeMode(text.safeModes["third-party"])), "A plugin held back by safe mode says so");
  check(card("noisy")!.querySelector(".plugins-v3__last-error") && card("noisy")!.textContent!.includes("1.50 s"), "A running plugin that erred keeps its last error within reach");
  check(card("broken")!.querySelector(".plugins-v3__kind")?.textContent === text.kinds["third-party"] && card("counter")!.querySelector(".plugins-v3__kind")?.textContent === text.kinds.builtin, "Each plugin says what kind it is");

  await send((given) => given.onEvent("plugins", PLUGINS.map((plugin) => (plugin.id === "counter" ? { ...plugin, usage: usage({ cpuMs: 20, timers: 1 }) } : plugin))));
  check(card("counter")!.textContent!.includes("20.0 ms"), "A plugins event updates the numbers in place");
  memoryReply = null;
  safeReply = { mode: "third-party", cause: "shift", failures: 0 };
  await send((given) => given.onEvent("host", { ...HOST, pid: 4343, rssBytes: 50 * MB }));
  await settle();
  check(memoryValue()?.textContent === "50.0 MB" && memoryValue()?.dataset.measure === "rss" && page.textContent?.includes(text.memoryTitles.rss), "When Fuyu cannot read a host's memory the page falls back to the host's own number and labels it as the working set");
  check(page.textContent?.includes(text.safeCauses.shift) && leaveButton() && !leaveButton()!.disabled, "A host started with Shift held says so, and the new host can be taken out of safe mode again");
  safeReply = { mode: "third-party", cause: "variable", failures: 0 };
  memoryReply = { pid: 4242, bytes: 30 * MB, measure: "phys-footprint" };
  await send((given) => given.onEvent("host", HOST));
  await settle();
  check(memoryValue()?.textContent === "30.0 MB" && page.textContent?.includes(text.memoryTitles["phys-footprint"]), "On macOS the label names phys_footprint");
  check(page.textContent?.includes(text.safeCauses.variable) && !leaveButton(), "Safe mode from the environment variable names it and has no button, since only removing the variable ends it");

  await send((given) => given.onState("reconnecting"));
  check(page.querySelector("[data-connection='reconnecting']")?.textContent === text.connection.reconnecting, "When the host restarts the page says it is reconnecting");
  check(page.querySelector(".plugins-v3__list--stale"), "and dims the last list it had");
  await send((given) => {
    given.onState("open");
    given.onSnapshot({ plugins: [PLUGINS[0]], host: { ...HOST, pid: 5151, safe: null, dev: false } });
  });
  check(page.textContent?.includes(text.hostDetail(5151, "26.12.0")) && page.querySelectorAll(".plugins-v3__plugin").length === 1, "After the restart the new snapshot replaces everything it showed");
  check(!page.textContent?.includes(text.safeMode), "A host out of safe mode no longer shows it");
  await send((given) => given.onSnapshot({ plugins: [], host: HOST }));
  check(page.textContent?.includes(text.empty), "With no plugins configured it says so");

  const narrow = document.getElementById("narrow")!;
  check(main.fake.open === 1 && side.fake.open === 1, "Each page keeps exactly one connection to the host open");
  const narrowHandlers = side.fake.handlers!;
  await act(async () => {
    narrowHandlers.onState("open");
    narrowHandlers.onSnapshot({ plugins: PLUGINS, host: HOST });
  });
  const overflowing = [...narrow.querySelectorAll<HTMLElement>(".plugins-v3__plugin, .plugins-v3__plugin-head, .plugins-v3__migration-item, .settings-row")].filter((element) => element.scrollWidth > element.clientWidth + 1);
  check(narrow.querySelectorAll(".plugins-v3__plugin").length > 0 && overflowing.length === 0, "In a 300 px wide window nothing spills out sideways");
  await act(async () => narrowRoot.unmount());
  check(side.fake.open === 0, "Leaving the page closes its connection");
  await send((given) => given.onSnapshot({ plugins: PLUGINS, host: HOST }));

  await act(async () => card("counter")!.click());
  const modal = page.querySelector<HTMLElement>("[role='dialog']");
  check(modal?.textContent?.includes("counter") && document.activeElement === modal.querySelector(".plugins-v3__modal-close"), "Clicking a plugin card opens its detail dialog and focuses the close button");
  await act(async () => { modal!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
  check(!page.querySelector("[role='dialog']"), "and Escape dismisses the dialog");

  const searchInput = page.querySelector<HTMLInputElement>(".plugins-v3__search input")!;
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => { valueSetter.call(searchInput, "local api"); searchInput.dispatchEvent(new Event("input", { bubbles: true })); });
  check(page.querySelectorAll(".plugins-v3__builtin").length === 1 && Boolean(builtinRow("local-api")), "Search finds built-in plugins by name across languages and ignores spaces or hyphens");
  await act(async () => page.querySelector<HTMLButtonElement>(".plugins-v3__search-clear")!.click());
  check(page.querySelectorAll(".plugins-v3__builtin").length === 22, "Clearing the search brings back all 22 built-in plugins");

  await act(async () => page.querySelector<HTMLButtonElement>("[data-tab='diagnostics']")!.click());
  check(page.querySelectorAll(".plugins-v3__diag-table tbody tr").length === 29, "The diagnostics tab lists all built-in and host plugins in a comparison table");
  await act(async () => page.querySelector<HTMLButtonElement>("[data-tab='plugins']")!.click());
  check(page.querySelectorAll(".plugins-v3__builtin").length === 22, "Switching back to the plugins tab restores the grouped card grid");

  const migrationCard = page.querySelector<HTMLElement>(".plugins-v3__migration");
  check(
    Boolean(migrationCard)
      && migrationCard!.textContent!.includes("dev.focusd.weather → @fuyu/weather")
      && migrationCard!.textContent!.includes(text.v2Migration.configCarried)
      && migrationCard!.textContent!.includes(text.v2Migration.switchedToV3)
      && migrationCard!.textContent!.includes("com.example.custom"),
    "The v2 migration guide lists mapped @fuyu/* official plugins, carried-over settings, and other legacy v2 plugins",
  );
  await act(async () => page.querySelector<HTMLButtonElement>("[data-action='migration-open-market']")!.click());
  await settle();
  check(page.querySelector("[data-tab='market']")?.getAttribute("aria-selected") === "true", "Clicking Open Plugin Market on the v2 migration card switches straight to the v3 market tab");
  check(
    Boolean(page.querySelector("[data-market-plugin='@fuyu/weather']"))
      && page.querySelector("[data-market-plugin='@fuyu/weather']")!.textContent!.includes(text.market.officialBadge)
      && page.querySelector("[data-market-plugin='@someone/clock']")!.textContent!.includes(text.market.cooldownBadge)
      && !page.querySelector("[data-action='market-install-file']"),
    "The v3 market tab lists official and cooldown badges and hides local .fuyu import while manual install is off",
  );
  await act(async () => page.querySelector<HTMLInputElement>(".plugins-v3__manual-toggle input")!.click());
  await settle();
  check(manualAllowed && Boolean(page.querySelector("[data-action='market-install-file']")), "Turning on manual .fuyu installation reveals the file import button");
  await act(async () => page.querySelector<HTMLElement>("[data-market-plugin='@fuyu/weather']")!.querySelector<HTMLButtonElement>("[data-action='market-open-detail']")!.click());
  await settle();
  const marketDetail = page.querySelector<HTMLElement>("[data-market-detail-modal='@fuyu/weather']");
  check(Boolean(marketDetail) && marketDetail!.textContent!.includes("Hourly forecast") && marketDetail!.textContent!.includes("MIT") && Boolean(marketDetail!.querySelector("[data-market-likes='42']")), "Clicking a market plugin title opens the rich detail modal with README, license, and likes");
  await act(async () => marketDetail!.querySelector<HTMLButtonElement>("[data-detail-tab='capabilities']")!.click());
  check(marketDetail!.textContent!.includes("Alt+W") && marketDetail!.textContent!.includes("api.open-meteo.com"), "Switching to Capabilities in the market detail modal lists commands, default keybindings, and network domains");
  await act(async () => { marketDetail!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
  check(!page.querySelector("[data-market-detail-modal='@fuyu/weather']"), "Escape closes the market detail modal");
  await act(async () => page.querySelector<HTMLElement>("[data-market-plugin='@fuyu/weather']")!.querySelector<HTMLButtonElement>("[data-action='market-install']")!.click());
  await settle();
  const installModal = page.querySelector<HTMLElement>("[data-install-modal='@fuyu/weather']");
  check(
    Boolean(installModal)
      && installModal!.textContent!.includes("api.open-meteo.com")
      && installModal!.textContent!.includes("island.page/v1")
      && installModal!.textContent!.includes(text.market.confirmModal.hostSecurityNote),
    "Clicking Install opens the confirmation modal with declared network domains, UI slots, and the host credential note",
  );
  await act(async () => installModal!.querySelector<HTMLButtonElement>("[data-action='confirm-install']")!.click());
  await settle();
  check(
    marketCalls.includes("installMarket:@fuyu/weather@1.0.0")
      && !page.querySelector("[data-install-modal='@fuyu/weather']")
      && page.querySelector("[data-market-plugin='@fuyu/weather']")!.textContent!.includes(text.market.installedBadge("1.0.0")),
    "Confirming installs the market plugin and marks the card as installed",
  );
  await act(async () => page.querySelector<HTMLButtonElement>("[data-tab='plugins']")!.click());
  await settle();

  await send((given) => given.onSnapshot({ plugins: [...PLUGINS, { id: "@fuyu/weather", name: "Weather", state: "running", kind: "third-party", source: "market" }], host: HOST }));
  await settle();
  await act(async () => card("@fuyu/weather")!.querySelector<HTMLInputElement>("input")!.click());
  await settle();
  check(marketCalls.includes("setEnabled:@fuyu/weather=false"), "Toggling a market-installed plugin card calls market/v1 setEnabled");
  await act(async () => card("@fuyu/weather")!.click());
  await settle();
  await act(async () => page.querySelector<HTMLElement>("[data-schema-field='autoRefresh'] input")!.click());
  await act(async () => page.querySelector<HTMLButtonElement>("[data-action='reset-plugin-config']")!.click());
  await act(async () => page.querySelector<HTMLElement>("[data-window-rule='disallowAlwaysOnTop'] input")!.click());
  await settle();
  check(configCalls.includes("set:@fuyu/weather:{\"autoRefresh\":false}") && configCalls.includes("reset:@fuyu/weather") && ruleCalls.includes("rules:@fuyu/weather:{\"disallowAlwaysOnTop\":true}"), "Plugin detail modal renders JSON Schema settings and window guardrail switches wired to plugin-config/v1 and plugin-windows/v1");
  await act(async () => page.querySelector<HTMLButtonElement>("[data-action='uninstall-plugin']")!.click());
  await act(async () => page.querySelector<HTMLButtonElement>("[data-action='confirm-uninstall-plugin']")!.click());
  await settle();
  check(marketCalls.includes("uninstall:@fuyu/weather:false") && !page.querySelector("[role='dialog']"), "Confirming uninstall in the detail modal removes the plugin via market/v1 and closes the modal");
  await send((given) => given.onSnapshot({ plugins: PLUGINS, host: HOST }));
  await settle();

  await act(async () => page.querySelector<HTMLButtonElement>(".plugins-v3__migration-dismiss")!.click());
  await settle();
  check(migrationDismissCalls.join() === "settings" && !page.querySelector(".plugins-v3__migration"), "Dismissing the v2 migration guide persists once and hides the banner without repeating");

  results.textContent = messages.join("\n");
  document.documentElement.dataset.testResult = "passed";
} catch (error) {
  results.textContent = [...messages, `FAIL ${error instanceof Error ? error.message : String(error)}`].join("\n");
  document.documentElement.dataset.testResult = "failed";
}
