import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles/tokens.css";
import "../../src/styles/fonts.css";
import "../../src/styles/base.css";
import "../../src/windows/settings/SettingsWindow.css";
import { ipc, locale, market, configCalls, PLUGIN, NORMAL, HOST, MB, REASON, held } from "./pluginPageMocks";
import { I18nProvider, TRANSLATIONS } from "../../src/i18n";
import type { HostNodeStatus } from "../../src/features/plugin-kernel/api";
import type { PluginHostView } from "../../src/windows/settings/usePluginHostStatus";
import type { PluginDetailRequest } from "../../src/windows/settings/pluginPageHandoff";

const { PluginsV3View } = await import("../../src/windows/settings/PluginsV3SettingsPage");
const { PluginPageActions } = await import("../../src/windows/settings/PluginPageActions");
const { takeMarketViewRequest } = await import("../../src/windows/settings/pluginPageHandoff");

const t = TRANSLATIONS[locale].settings.pluginsV3.page;
market.revocationCases = true;
Object.assign(market.installed, { "@someone/sketchy": "0.5.0", "@someone/translator": "1.0.0" });
const REVOCATION = [...NORMAL, PLUGIN.shady, PLUGIN.sketchy, PLUGIN.translator];
const open = (plugins: PluginHostView["plugins"], more: Partial<PluginHostView> = {}): PluginHostView => ({ connection: "open", plugins, host: HOST, memory: null, safeMode: null, ...more });
const safeHost = { ...HOST, safe: "third-party" as const };

interface Stage { key: string; title: string; view: PluginHostView; node?: HostNodeStatus | null; hostOff?: boolean; detail?: PluginDetailRequest; migration?: boolean; narrow?: boolean; head?: boolean }
const STAGES: Stage[] = [
  { key: "settings", title: "插件设置 / Plugin settings", view: open(NORMAL), detail: { id: "@fuyu/weather", tab: "settings" } },
  { key: "normal", title: "已安装若干 / Installed", view: open(NORMAL), head: true },
  { key: "empty", title: "空状态 / Empty", view: open([PLUGIN.counter]) },
  { key: "update", title: "有可更新 / Update", view: open([...NORMAL, PLUGIN.pomodoro]) },
  { key: "error", title: "出错 / Error", view: open([...NORMAL, PLUGIN.feeds, PLUGIN.flaky, PLUGIN.linked]) },
  { key: "attention", title: "等依赖 / Attention", view: open([...NORMAL, PLUGIN.todoSync, PLUGIN.shady]) },
  { key: "revocation", title: "撤销与等确认 / Revoked and held", view: open(REVOCATION) },
  { key: "migration", title: "旧插件迁移 / Migration", view: open(NORMAL), migration: true },
  { key: "nodeDl", title: "运行环境下载中 / Runtime downloading", view: { ...open(null), connection: "connecting", host: null }, node: { state: "downloading", downloaded: 12 * MB, total: 30 * MB } },
  { key: "nodeFail", title: "运行环境下载失败 / Runtime failed", view: { ...open(null), connection: "connecting", host: null }, node: { state: "failed", error: "Node 22.15 or newer was not found; all 3 download sources failed" } },
  { key: "safe", title: "安全模式 / Safe mode", view: open(NORMAL.map(held), { host: safeHost, safeMode: { mode: "third-party", cause: "failures", failures: 2 } }) },
  { key: "safeVar", title: "安全模式（启动参数）/ Safe mode (variable)", view: open(NORMAL.map(held), { host: safeHost, safeMode: { mode: "third-party", cause: "variable", failures: 0 } }) },
  { key: "offline", title: "插件进程连不上 / Offline", view: open(NORMAL, { connection: "reconnecting" }) },
  { key: "hostOff", title: "插件功能被关掉 / Plugins off", view: { connection: "closed", plugins: [], host: null, memory: null, safeMode: null }, hostOff: true },
  { key: "loading", title: "加载中 / Loading", view: { connection: "connecting", plugins: null, host: null, memory: null, safeMode: null } },
  { key: "narrow-error", title: "窄窗口 / Narrow", view: open([...NORMAL, PLUGIN.feeds, PLUGIN.flaky]), narrow: true },
  { key: "narrow-attention", title: "窄窗口 / Narrow", view: open([...NORMAL, PLUGIN.todoSync, PLUGIN.shady, PLUGIN.pomodoro]), narrow: true },
  { key: "narrow-revocation", title: "窄窗口 / Narrow", view: open(REVOCATION), narrow: true },
];

const opened: string[] = [];
const messages: string[] = [];
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
  messages.push(`PASS ${message}`);
};
const settle = (ms = 60) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });
const gallery = document.getElementById("gallery")!;
const stage = (key: string) => gallery.querySelector<HTMLElement>(`[data-stage='${key}']`)!;
const within = (key: string, selector: string) => stage(key).querySelector<HTMLElement>(selector);
const all = (key: string, selector: string) => [...stage(key).querySelectorAll<HTMLElement>(selector)];
const row = (key: string, id: string) => within(key, `.plugin-row[data-plugin='${id}']`);
const click = (element: Element | null | undefined) => act(async () => { if (!element) throw new Error("missing element to click"); (element as HTMLElement).click(); });
const press = (element: Element, key: string) => act(async () => { element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })); });
const dialog = (id: string) => document.querySelector<HTMLElement>(`[data-plugin-detail='${id}']`);
const type = async (input: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => { setter.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
};
const rowAction = (key: string, id: string, action: string) => row(key, id)?.querySelector<HTMLElement>(`[data-row-action='${action}']`);
const openRowMenu = async (key: string, id: string) => {
  await click(row(key, id)?.querySelector(".plugin-row__aside .plugin-menu > button"));
  return [...(row(key, id)?.querySelectorAll<HTMLElement>("[data-menu-item]") ?? [])];
};
const results = document.getElementById("results")!;

async function mount(item: Stage) {
  const host = document.createElement("section");
  host.className = `gallery__stage settings-stage${item.narrow ? " gallery__stage--narrow" : ""}`;
  host.dataset.stage = item.key;
  const title = document.createElement("h2");
  title.className = "gallery__title";
  title.textContent = item.title;
  const body = document.createElement("div");
  host.append(title, body);
  gallery.append(host);
  ipc.migrationPending = Boolean(item.migration);
  await act(async () => {
    createRoot(body).render(
      <StrictMode>
        <I18nProvider>
          {item.head ? <div className="gallery__head"><PluginPageActions onOpenPage={(page) => opened.push(`head:${page}`)} /></div> : null}
          <PluginsV3View view={item.view} hostOff={item.hostOff} node={item.node ?? null} builtins={ipc.builtins} initialDetail={item.detail ?? null} onOpenPage={(page) => opened.push(`${item.key}:${page}`)} />
        </I18nProvider>
      </StrictMode>,
    );
  });
  await settle(80);
  ipc.migrationPending = false;
}

try {
  for (const item of STAGES) await mount(item);
  const builtinIds = ipc.builtins.map((plugin) => plugin.id);
  check(builtinIds.every((id) => !gallery.querySelector(`.plugin-row[data-plugin='${id}']`)) && !gallery.querySelector(".plugin-row[data-plugin='counter']"), "No built-in module appears as a plugin row in any state");
  check(!/第 ?3 ?版|\bv3\b|宿主|plugins-v3|FUYU_PLUGINS_V3/i.test(gallery.textContent ?? ""), "No state shows 第 3 版, v3, 宿主 or internal file names");

  const weather = dialog("@fuyu/weather")!;
  check(weather?.querySelector("[data-tab='settings']")?.getAttribute("aria-selected") === "true" && weather.querySelector("[data-schema-field='autoRefresh']"), "Settings: the detail dialog can open straight on the settings tab with the plugin's own form");
  await click(weather.querySelector("[data-schema-field='autoRefresh'] input"));
  await settle();
  check(configCalls.includes("set:@fuyu/weather:{\"autoRefresh\":false}"), "and changing a field saves it through plugin-config");
  await click(weather.querySelector("[data-tab='commands']"));
  await settle();
  check(weather.querySelectorAll("[data-command]").length === 2 && weather.querySelector("[data-command='refresh'] .plugin-kbd") && weather.textContent!.includes(locale === "en" ? "Refresh weather" : "刷新天气"), "The commands tab lists the plugin's commands with their shortcuts");
  check(!weather.querySelector("[data-tab='permissions']") && !/权限|permission/i.test(weather.querySelector("[role='tablist']")?.textContent ?? ""), "There is no permissions tab");
  await click(weather.querySelector("[data-tab='overview']"));
  await settle();
  check(weather.querySelector("[data-plugin-capabilities] [data-capability='network']") && weather.textContent!.includes("api.open-meteo.com") && weather.querySelector(".plugin-cap--sensitive"), "The overview says what the plugin does: the addresses it connects to and the system abilities it uses, marked");
  check(weather.querySelector("[data-plugin-window-rules='@fuyu/weather']"), "and holds the separate-window rules");
  check(!/权限|permission/i.test(weather.textContent ?? ""), "and never talks about permissions");
  await click(weather.querySelector("[data-tab='settings']"));
  await settle();

  check(all("normal", ".plugin-row").length === 4 && !gallery.querySelector("[data-stage='normal'] .plugin-banner"), "Normal: four installed plugins and no banner");
  const titles = all("normal", ".plugin-row__name").map((element) => element.textContent!.trim());
  check(titles.join("|") === [...titles].sort((a, b) => a.localeCompare(b, locale)).join("|"), "Rows are sorted by name");
  check(row("normal", "@fuyu/weather")?.querySelector(".plugin-badge--official") && row("normal", "@me/gadget")?.querySelector(".plugin-badge--warn") && row("normal", "@me/gadget")?.classList.contains("plugin-row--off"), "Official plugins carry a badge, file installs carry an unreviewed badge, and a switched-off plugin is dimmed");
  const chip = (filter: string) => within("normal", `[data-filter='${filter}']`) as HTMLButtonElement;
  check(chip("all").textContent!.includes("4") && chip("on").textContent!.includes("3") && chip("off").textContent!.includes("1") && chip("attention").disabled, "Filter chips count all, on and off, and the attention chip is disabled at zero");
  await click(chip("off"));
  check(all("normal", ".plugin-row").length === 1 && chip("off").getAttribute("aria-pressed") === "true", "The off chip leaves only the switched-off plugin");
  await click(chip("all"));
  await type(within("normal", ".plugin-search input") as HTMLInputElement, "zzz");
  check(within("normal", "[data-no-match]") && all("normal", ".plugin-row").length === 0, "A search with no match says so");
  await click(within("normal", "[data-action='search-market']"));
  check(opened.includes("normal:pluginMarket") && takeMarketViewRequest()?.query === "zzz", "and offers to search the market for the same words");
  await click(within("normal", ".plugin-search__clear"));
  check(all("normal", ".plugin-row").length === 4, "Clearing the search brings every row back");
  await click(row("normal", "@someone/clock")?.querySelector("input[role='switch'], .settings-switch input"));
  await settle();
  check(market.calls.includes("enabled:@someone/clock=false"), "A row's switch turns the plugin off through the market service");
  const menu = await openRowMenu("normal", "@someone/clock");
  check(menu.map((item) => item.dataset.menuItem).join() === "restart,log,market,uninstall", "The row menu offers restart, log, view in market and uninstall");
  await click(menu.find((item) => item.dataset.menuItem === "uninstall"));
  await settle();
  const clock = dialog("@someone/clock");
  check(clock?.querySelector("[data-uninstall-confirm]"), "Uninstall from the menu opens the detail dialog at the confirmation");
  await click(clock!.querySelector("[data-action='confirm-uninstall-plugin']"));
  await settle();
  check(market.calls.includes("uninstall:@someone/clock:false") && !dialog("@someone/clock"), "Confirming uninstalls it, keeps its data by default and closes the dialog");
  await click(row("normal", "my-local-tool")?.querySelector("[data-action='open-settings']"));
  await settle();
  const local = dialog("my-local-tool")!;
  check(local && !local.querySelector("[data-action='uninstall-plugin']") && local.querySelector("[data-tab='settings']")?.getAttribute("aria-selected") === "true", "The gear opens settings; a plugin loaded from a folder has no uninstall button");
  await press(local, "Escape");
  check(!dialog("my-local-tool"), "Escape closes the detail dialog");
  await click(within("normal", "[data-action='open-overview']"));
  check(opened.includes("normal:overview"), "The footnote links to the overview page");
  await click(within("normal", "[data-action='open-market']"));
  check(opened.includes("head:pluginMarket"), "The header button opens the plugin market");
  await click(within("normal", ".gallery__head .plugin-menu > button"));
  const headItems = [...stage("normal").querySelectorAll<HTMLElement>(".gallery__head [data-menu-item]")];
  check(headItems.map((item) => item.dataset.menuItem).join() === "install-file,allow-files,check-updates,diagnostics,dev-docs", "The header menu holds install from file, allow files, check updates, diagnostics and developer docs");
  await click(headItems.find((item) => item.dataset.menuItem === "diagnostics"));
  check(opened.includes("head:pluginDiagnostics"), "and diagnostics opens the diagnostics sub-page");

  check(within("empty", "[data-empty]") && all("empty", "[data-popular]").map((item) => item.dataset.popular).join() === "@fuyu/countdown,@someone/stocks,@someone/notes", "Empty: the page invites to the market and suggests three plugins, official first");
  await click(within("empty", "[data-action='browse-market']"));
  check(opened.includes("empty:pluginMarket"), "and its main button opens the market");

  const updates = within("update", "[data-banner='updates']");
  check(updates?.textContent!.includes(locale === "en" ? "Pomodoro v1.1.0" : "番茄钟 v1.1.0") && row("update", "@fuyu/pomodoro")?.querySelector("[data-note='update']"), "Update: a banner names the update and the row carries it");
  await click(rowAction("update", "@fuyu/pomodoro", "update"));
  await settle();
  const updateModal = document.querySelector<HTMLElement>("[data-install-modal='@fuyu/pomodoro']");
  check(updateModal, "Updating from the row asks for confirmation first");
  await press(updateModal!, "Escape");

  check(within("error", "[data-banner='problems']") && row("error", "@someone/feeds")?.dataset.dot === "bad", "Error: a banner counts the broken plugins and their dot turns red");
  const feedsNote = row("error", "@someone/feeds")?.querySelector<HTMLElement>("[data-note='failed']");
  check(feedsNote?.textContent!.includes("Cannot read properties") && !feedsNote.textContent!.includes("at parse"), "The row shows only the first line of the error");
  check(row("error", "@someone/flaky-plugin-with-a-really-long-identifier-that-should-not-overflow")?.querySelector("[data-note='paused']"), "A plugin paused for repeated errors says so");
  const linkedNote = row("error", "@me/linked")?.querySelector<HTMLElement>("[data-note='unreachable']");
  check(row("error", "@me/linked")?.dataset.dot === "bad" && Boolean(linkedNote?.textContent!.includes("island, settings")), "A plugin whose window files Fuyu cannot read names those windows");
  await click(rowAction("error", "@someone/feeds", "restart"));
  await settle();
  check(market.calls.indexOf("enabled:@someone/feeds=false") >= 0 && market.calls.indexOf("enabled:@someone/feeds=true") > market.calls.indexOf("enabled:@someone/feeds=false"), "Restart switches the plugin off and on again");
  await click(rowAction("error", "@someone/feeds", "log"));
  await settle();
  const feeds = dialog("@someone/feeds")!;
  check(feeds?.querySelector("[data-tab='activity']")?.getAttribute("aria-selected") === "true" && feeds.querySelector(".plugin-log")?.textContent!.includes("at parse"), "View log opens the activity tab with the full error");
  await press(feeds, "Escape");
  await click(within("error", "[data-action='open-diagnostics']"));
  check(opened.includes("error:pluginDiagnostics"), "The problem banner leads to diagnostics");

  check(within("attention", "[data-banner='attention']") && row("attention", "@someone/shady")?.querySelector("[data-note='revoked']"), "Attention: a banner counts plugins that need a look; a revoked plugin says so");
  await click(rowAction("attention", "@someone/todo-sync", "turnOnProvider"));
  await settle();
  check(ipc.calls.includes("builtin:todos=true"), "A plugin waiting on a switched-off feature offers to turn that feature on");
  await click(within("attention", "[data-action='only-attention']"));
  check(all("attention", ".plugin-row").length === 2 && within("attention", "[data-filter='attention']")?.getAttribute("aria-pressed") === "true", "Show only these filters the list to the plugins that need attention");

  const shady = row("revocation", "@someone/shady")!;
  const shadySwitch = shady.querySelector<HTMLInputElement>(".plugin-row__switch input")!;
  check(shady.querySelector("[data-note='revoked'] .plugin-note__list")?.textContent!.includes(REASON.shady[locale]) && shady.querySelector("[data-row-action='uninstall']"), "Revoked: the row gives the market's reason and offers to uninstall");
  check(shadySwitch.disabled && shady.querySelector(".plugin-row__switch")?.getAttribute("title") === t.notes.revokedSwitch, "and its switch is locked, saying why");
  await click(shadySwitch);
  await settle();
  check(!market.calls.includes("enabled:@someone/shady=true"), "Clicking the locked switch does not try to turn it on");
  const sketchy = row("revocation", "@someone/sketchy")!;
  check(sketchy.querySelector("[data-note='warned']")?.textContent!.includes(REASON.sketchy[locale]) && sketchy.querySelector("[data-row-action='update']") && sketchy.dataset.dot === "ok", "Warned: a running plugin shows the market's warning and reason, with the newer version to update to");
  check(!sketchy.querySelector<HTMLInputElement>(".plugin-row__switch input")!.disabled, "and its switch still works");
  const translator = row("revocation", "@someone/translator")!;
  const heldList = translator.querySelector("[data-note='held'] .plugin-note__list")?.textContent ?? "";
  check(["api.deepl.com", "child_process", "translation/v1"].every((item) => heldList.includes(item)) && translator.querySelector("[data-note='held']")?.textContent!.includes(t.notes.held("1.1.0")), "Held: the row says the new version does more and lists the new address, Node module and replaced service");
  check(!/权限|permission/i.test(stage("revocation").textContent ?? ""), "and none of these states talks about permissions");
  await click(translator.querySelector("[data-row-action='update']"));
  await settle();
  const heldModal = document.querySelector<HTMLElement>("[data-install-modal='@someone/translator']");
  check(heldModal, "Updating a held plugin opens the usual confirmation");
  await press(heldModal!, "Escape");
  market.revokeOnEnable = "@me/gadget";
  await click(row("revocation", "@me/gadget")?.querySelector(".plugin-row__switch input"));
  await settle();
  market.revokeOnEnable = null;
  check(row("revocation", "@me/gadget")?.querySelector(".plugin-row__switch[data-error]")?.getAttribute("title")?.includes(REASON.shady[locale]), "If turning a plugin on is refused as revoked, the switch gives the market's reason");

  check(within("migration", "[data-banner='migration']")?.querySelector("[data-v2-official='dev.focusd.countdown'] [data-action='migration-get']"), "Migration: old official plugins not yet installed offer an install button");
  await click(within("migration", "[data-action='migration-get']"));
  check(opened.includes("migration:pluginMarket") && takeMarketViewRequest()?.detail === "@fuyu/countdown", "which opens that plugin in the market");
  check(!within("normal", "[data-banner='migration']"), "The migration card only shows while it is pending");

  check(within("nodeDl", "[data-banner='runtime-downloading'] [role='progressbar']")?.getAttribute("aria-valuenow") === "40" && within("nodeDl", ".plugin-row--skeleton"), "Runtime downloading: a banner shows the progress above the loading list");
  check(within("nodeFail", "[data-banner='runtime-failed']")?.textContent!.includes("all 3 download sources failed") && !within("nodeFail", ".plugin-row--skeleton"), "Runtime failed: the banner says why and the loading list is gone");
  await click(within("nodeFail", "[data-action='runtime-retry']"));
  await settle();
  check(ipc.calls.includes("retry-node"), "Retry asks Fuyu to look for the runtime again");

  check(within("safe", "[data-banner='safe-mode']")?.textContent!.includes(t.banners.safeFailures(2)) && row("safe", "@fuyu/weather")?.dataset.dot !== "ok", "Safe mode: the banner says why and held plugins are not shown as running");
  await click(within("safe", "[data-action='leave-safe-mode']"));
  await settle();
  check(ipc.calls.includes("leave-safe") && (within("safe", "[data-action='leave-safe-mode']") as HTMLButtonElement).disabled, "Leaving safe mode asks Fuyu once and waits");
  check(within("safeVar", "[data-banner='safe-mode']")?.textContent!.includes(t.banners.safeVariable) && !within("safeVar", "[data-action='leave-safe-mode']"), "Safe mode from a start option has no leave button, only how to remove it");

  check(within("offline", "[data-banner='offline']") && within("offline", ".plugin-list--stale") && all("offline", ".plugin-row input").every((input) => (input as HTMLInputElement).disabled), "Offline: the last list stays dimmed and its switches are locked");
  check(within("hostOff", "[data-banner='host-off']") && !within("hostOff", ".plugin-row") && !within("hostOff", "[data-empty]"), "Plugins off: one banner explains it and no list is shown");
  check(within("loading", ".plugin-list[aria-busy='true']") && !within("loading", ".plugin-banner"), "Loading: a skeleton list and no banner");

  const spills = [...gallery.querySelectorAll<HTMLElement>(".gallery__stage--narrow :is(.plugin-row, .plugin-banner, .plugin-page__toolbar, .plugin-note, .plugin-page__summary)")].filter((element) => element.scrollWidth > element.clientWidth + 1);
  check(spills.length === 0, spills.length ? `Narrow: ${spills.map((element) => element.className).join(", ")} spill out sideways at 340 px` : "Narrow: nothing spills out sideways at 340 px");

  results.textContent = messages.join("\n");
  document.documentElement.dataset.testResult = "passed";
} catch (error) {
  results.textContent = [...messages, `FAIL ${error instanceof Error ? error.message : String(error)}`].join("\n");
  document.documentElement.dataset.testResult = "failed";
}
