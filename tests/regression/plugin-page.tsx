import { act, StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles/tokens.css";
import "../../src/styles/fonts.css";
import "../../src/styles/base.css";
import "../../src/windows/settings/SettingsWindow.css";
import { marketV1 } from "@fuyu/plugin-services";
import { ipc, locale, market, configCalls, windowServices, PLUGIN, NORMAL, HOST, MB, REASON, held } from "./pluginPageMocks";
import { I18nProvider, TRANSLATIONS } from "../../src/i18n";
import type { HostNodeStatus } from "../../src/features/plugin-kernel/api";
import type { PluginHostView, PluginStatusV3 } from "../../src/windows/settings/usePluginHostStatus";
import type { BarUsageView } from "../../src/windows/settings/usePluginBarUsage";
import { BAR, BAR_OPEN, ON_BAR, checkBarUsage } from "./pluginPageBar";
import { checkRoster } from "./pluginPageRoster";
import type { PluginDetailRequest } from "../../src/windows/settings/pluginPageHandoff";

const { PluginsV3View } = await import("../../src/windows/settings/PluginsV3SettingsPage");
const { PluginPageActions } = await import("../../src/windows/settings/PluginPageActions");
const { takeMarketViewRequest } = await import("../../src/windows/settings/pluginPageHandoff");

const t = TRANSLATIONS[locale].settings.pluginsV3.page;
market.revocationCases = true;
market.reach = true;
localStorage.removeItem("fuyu-collapsed-items");
market.manualInstalled["@me/gadget"] = "0.2.0";
Object.assign(market.installed, { "@someone/sketchy": "0.5.0", "@someone/translator": "1.0.0" });
const REVOCATION = [...NORMAL, PLUGIN.shady, PLUGIN.sketchy, PLUGIN.translator];
const open = (plugins: PluginHostView["plugins"], more: Partial<PluginHostView> = {}): PluginHostView => ({ connection: "open", plugins, host: HOST, memory: null, safeMode: null, ...more });
const safeHost = { ...HOST, safe: "third-party" as const };
const SETUP_HINT = { "zh-CN": "选一个城市", en: "Pick a city" };
const COUNTDOWN_HINT = { "zh-CN": "添加一个日子", en: "Add a date" };
const NEEDS_SETUP: PluginStatusV3[] = [{ ...PLUGIN.weather, setup: { hint: SETUP_HINT } }, { ...PLUGIN.local, setup: {} }, PLUGIN.clock, { ...PLUGIN.gadget, setup: { hint: "off" } }];
const COUNTDOWN: PluginStatusV3 = { id: "@fuyu/countdown", name: "Countdown", state: "running", kind: "third-party", source: "market" };

interface Stage { key: string; title: string; view: PluginHostView; node?: HostNodeStatus | null; hostOff?: boolean; detail?: PluginDetailRequest; migration?: boolean; narrow?: boolean; head?: boolean; bar?: BarUsageView }
const STAGES: Stage[] = [
  { key: "settings", title: "插件设置 / Plugin settings", view: open(NORMAL), detail: { id: "@fuyu/weather", tab: "settings" } },
  { key: "normal", title: "已安装若干 / Installed", view: open([...NORMAL, PLUGIN.hello]), head: true },
  { key: "fewBad", title: "少而有问题 / Few with a problem", view: open([PLUGIN.weather, PLUGIN.feeds]) },
  { key: "many", title: "装了 6 个 / Six installed", view: open([PLUGIN.weather, PLUGIN.clock, PLUGIN.local, PLUGIN.pomodoro, PLUGIN.feeds, PLUGIN.sketchy]) },
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
  { key: "setup", title: "待设置 / Needs setup", view: open(NEEDS_SETUP) },
  { key: "narrow-setup", title: "窄窗口 / Narrow", view: open(NEEDS_SETUP), narrow: true },
  { key: "bar", title: "收起条占用 / Bar usage", view: open(ON_BAR), bar: BAR },
  { key: "bar-open", title: "岛展开着 / Island open", view: open(ON_BAR), bar: BAR_OPEN },
  { key: "narrow-bar", title: "窄窗口 / Narrow", view: open(ON_BAR), bar: BAR, narrow: true },
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

const liveViews = new Map<string, (view: PluginHostView) => void>();
function LiveStage({ item }: { item: Stage }) {
  const [view, setView] = useState(item.view);
  useEffect(() => {
    liveViews.set(item.key, setView);
  }, [item.key]);
  return <PluginsV3View view={view} hostOff={item.hostOff} node={item.node ?? null} builtins={ipc.builtins} initialDetail={item.detail ?? null} barUsage={item.bar} onBarChanged={() => opened.push(`${item.key}:bar-changed`)} onOpenPage={(page) => opened.push(`${item.key}:${page}`)} />;
}
const showView = (key: string, view: PluginHostView) => act(async () => liveViews.get(key)!(view));

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
          <LiveStage item={item} />
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

  check(all("normal", ".plugin-row").length === 5 && !gallery.querySelector("[data-stage='normal'] .plugin-banner"), "Normal: five installed plugins and no banner");
  const titles = all("normal", ".plugin-row__name").map((element) => element.textContent!.trim());
  check(titles.join("|") === [...titles].sort((a, b) => a.localeCompare(b, locale)).join("|"), "Rows are sorted by name");
  check(row("normal", "@fuyu/weather")?.querySelector("[data-official]") && row("normal", "@fuyu/weather")?.querySelector(".plugin-icon__img") && !row("normal", "@me/gadget")?.querySelector("[data-official]") && row("normal", "@me/gadget")?.querySelector(".plugin-badge--warn") && row("normal", "@me/gadget")?.classList.contains("plugin-row--off"), "Official plugins carry a check mark, file installs carry an unreviewed badge, and a switched-off plugin is dimmed");
  check(!within("normal", ".plugin-page__toolbar") && !within("normal", ".plugin-search"), "Fewer than six plugins: no search box and no filter chips");
  check(!within("fewBad", ".plugin-search") && all("fewBad", "[data-filter]").map((item) => item.dataset.filter).join() === "attention", "With few plugins and a problem, only the attention chip shows");
  await click(within("fewBad", "[data-filter='attention']"));
  check(all("fewBad", ".plugin-row").length === 1, "and it narrows the list to the broken plugin");
  await click(within("fewBad", "[data-filter='attention']"));
  check(all("fewBad", ".plugin-row").length === 2, "Clicking it again shows every plugin");
  const chip = (filter: string) => within("many", `[data-filter='${filter}']`);
  check(within("many", ".plugin-search") && chip("all")?.textContent!.includes("6") && chip("on")?.textContent!.includes("6") && !chip("off") && chip("attention")?.textContent!.includes("2"), "Six plugins bring the search box; chips with nothing to show are hidden");
  await click(chip("attention"));
  check(all("many", ".plugin-row").length === 2 && chip("attention")?.getAttribute("aria-pressed") === "true", "The attention chip leaves only the plugins that need a look");
  await click(chip("all"));
  await type(within("many", ".plugin-search input") as HTMLInputElement, "zzz");
  check(within("many", "[data-no-match]") && all("many", ".plugin-row").length === 0, "A search with no match says so");
  await click(within("many", "[data-action='search-market']"));
  check(opened.includes("many:pluginMarket") && takeMarketViewRequest()?.query === "zzz", "and offers to search the market for the same words");
  await click(within("many", ".plugin-search__clear"));
  check(all("many", ".plugin-row").length === 6, "Clearing the search brings every row back");

  const weatherRow = row("normal", "@fuyu/weather")!;
  check([...weatherRow.querySelectorAll<HTMLElement>("[data-place]")].map((item) => item.dataset.place).join() === "page,bar,alerts,settings" && !weatherRow.querySelector(".plugin-row__facts")?.textContent!.includes(locale === "en" ? "Plugin market" : "插件市场"), "The second line says where the plugin shows up on the island, not the market");
  await click(weatherRow.querySelector("button[data-place='page']"));
  check(ipc.calls.includes(`emit:island-open-plugin-page:{"pluginId":"@fuyu/weather"}`), "Clicking Island page asks the island to expand on that plugin's page");
  check(weatherRow.querySelector("[data-action='open-settings']") && !row("normal", "@someone/clock")?.querySelector("[data-action='open-settings']") && row("normal", "my-local-tool")?.querySelector("[data-action='open-settings']"), "A plugin with no settings has no gear; one we cannot read still has it");
  const gadgetRow = row("normal", "@me/gadget")!;
  check(gadgetRow.querySelector(".plugin-row__version")?.textContent === t.versions.localNewer("0.2.0") && gadgetRow.querySelector("[data-origin='manual']")?.textContent!.includes(t.sources.manual) && gadgetRow.querySelector("span[data-place='page']") && !gadgetRow.querySelector("button[data-place='page']"), "A file install newer than the market says so and where it came from; a switched-off plugin's page tag is not a link");
  check(row("normal", "my-local-tool")?.querySelector("[data-origin='local']")?.textContent === t.sources.local, "A plugin loaded from a folder says so");
  await click(row("normal", "@someone/clock")?.querySelector(".plugin-row__name"));
  await settle();
  const clockDetail = dialog("@someone/clock")!;
  check(clockDetail && !clockDetail.querySelector("[data-tab='settings']") && clockDetail.querySelector("[data-where] [data-place='bar']"), "Its detail has no settings tab and lists where it shows up");
  check(!clockDetail.querySelector("[data-notice-switch]"), "A plugin that sends no island alerts has no alerts switch");
  await press(clockDetail, "Escape");
  await click(gadgetRow.querySelector(".plugin-row__name"));
  await settle();
  const gadgetDetail = dialog("@me/gadget")!;
  check(gadgetDetail.querySelector("[data-newer-than-market]") && gadgetDetail.textContent!.includes(t.detail.facts.marketVersion) && gadgetDetail.textContent!.includes(t.versions.local("0.2.0")) && gadgetDetail.textContent!.includes(t.sources.manual) && !gadgetDetail.querySelector("[data-official]"), "The detail of a newer file install gives both versions, the source and why there is no check mark");
  await press(gadgetDetail, "Escape");
  await click(weatherRow.querySelector("button[data-place='settings']"));
  await settle();
  const weatherDetails = [...document.querySelectorAll<HTMLElement>("[data-plugin-detail='@fuyu/weather']")];
  const weatherDetail = weatherDetails[weatherDetails.length - 1];
  check(weatherDetails.length === 2 && weatherDetail.querySelector("[data-tab='settings']")?.getAttribute("aria-selected") === "true", "Has settings opens the detail on its settings tab");
  await click(weatherDetail.querySelector("[data-tab='overview']"));
  await click(weatherDetail.querySelector("[data-action='open-on-island']"));
  check(ipc.calls.filter((call) => call.startsWith("emit:island-open-plugin-page")).length === 2, "The detail's Open on the island does the same");
  const alertsSwitch = () => weatherDetail.querySelector<HTMLInputElement>("[data-notice-switch='@fuyu/weather'] input");
  const alertsTag = () => weatherRow.querySelector<HTMLElement>("[data-place='alerts']");
  check(alertsSwitch()?.checked === true && alertsTag()?.textContent === t.places.alerts, "A plugin that sends island alerts has an alerts switch in its detail, on by default");
  await click(alertsSwitch());
  check(localStorage.getItem("fuyu-plugin-notice-mutes") === '["@fuyu/weather"]' && alertsSwitch()?.checked === false, "Turning it off stores that plugin's id, and only that one, in the mute list");
  check(alertsTag()?.dataset.muted === "true" && alertsTag()?.textContent === t.notices.mutedTag && !row("normal", "@me/gadget")?.querySelector("[data-muted]"), "Its row then says the alerts are muted; other plugins' rows do not");
  await click(alertsSwitch());
  check(localStorage.getItem("fuyu-plugin-notice-mutes") === "[]" && alertsSwitch()?.checked === true && !alertsTag()?.dataset.muted, "Turning it back on takes it out of the list");
  localStorage.removeItem("fuyu-plugin-notice-mutes");
  await press(weatherDetail, "Escape");

  check(all("normal", "[data-suggest]").map((item) => item.dataset.suggest).join() === "@fuyu/countdown,@someone/stocks,@someone/notes" && within("normal", "[data-suggestions] [data-action='browse-market']"), "Below the list: three plugins not installed yet, official first, then a card to the market");
  await click(within("normal", "[data-action='install-suggested']"));
  await settle();
  const suggestModal = document.querySelector<HTMLElement>("[data-install-modal='@fuyu/countdown']");
  check(suggestModal, "A suggested plugin installs through the usual confirmation");
  await press(suggestModal!, "Escape");
  await click(within("normal", "[data-suggestions] [data-action='browse-market']"));
  check(opened.includes("normal:pluginMarket"), "The last card opens the market");
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
  check(local && local.querySelector("[data-action='uninstall-plugin']")?.textContent === t.detail.remove && local.querySelector("[data-tab='settings']")?.getAttribute("aria-selected") === "true", "The gear opens settings; a plugin listed by file path offers remove from Fuyu");
  await click(local.querySelector("[data-action='uninstall-plugin']"));
  check(local.querySelector("[data-uninstall-confirm]")?.textContent!.includes(t.detail.removeNoteFile), "and its confirmation says only the plugins.yml entry goes");
  await press(local, "Escape");
  check(!dialog("my-local-tool"), "Escape closes the detail dialog");
  const helloRow = row("normal", "hello");
  check(helloRow?.querySelector("[data-origin='local']")?.textContent === t.sources.local && !helloRow.querySelector("[data-place]") && !helloRow.querySelector(".plugin-row__switch"), "A plugin from fuyu-plugin dev says it was loaded from a folder, has no place tags and no switch");
  await click(helloRow!.querySelector(".plugin-row__name"));
  await settle();
  const helloFoot = dialog("hello")?.querySelector("[data-action='uninstall-plugin']");
  check(helloFoot?.textContent === t.detail.remove, "Its detail dialog offers remove from Fuyu instead of uninstall");
  await press(dialog("hello")!, "Escape");
  const helloMenu = await openRowMenu("normal", "hello");
  const helloRemove = helloMenu.find((item) => item.dataset.menuItem === "uninstall");
  check(helloMenu.map((item) => item.dataset.menuItem).join() === "restart,log,uninstall" && helloRemove?.textContent === t.actions.remove && helloMenu[0].hasAttribute("disabled"), "Its row menu keeps restart off and offers remove from Fuyu");
  await click(helloRemove);
  await settle();
  const hello = dialog("hello")!;
  check(hello.querySelector("[data-uninstall-confirm]")?.textContent!.includes(t.detail.removeNote) && hello.querySelector("[data-action='confirm-uninstall-plugin']")?.textContent === t.detail.confirmRemove, "The confirmation says the plugin folder stays and fuyu-plugin dev brings it back");
  await click(hello.querySelector(".plugin-check input"));
  await click(hello.querySelector("[data-action='confirm-uninstall-plugin']"));
  await settle();
  check(market.calls.includes("uninstall:hello:true") && !dialog("hello"), "Confirming removes it with its data when ticked and closes the dialog");
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

  const setupWeather = row("setup", "@fuyu/weather")!;
  check(setupWeather.querySelector("[data-badge='setup']")?.textContent === t.badges.setup && setupWeather.querySelector("[data-note='setup']")?.textContent!.includes(SETUP_HINT[locale]), "Setup: a plugin that reports it still needs setup carries a mark and says what is missing");
  check(row("setup", "my-local-tool")?.querySelector("[data-note='setup']")?.textContent!.includes(t.setup.note(null)) && within("setup", "[data-summary-setup]")?.textContent === t.summary.setup(2), "One that gives no hint gets the general line, and the summary counts both");
  check(!row("setup", "@someone/clock")?.querySelector("[data-badge='setup'], [data-note='setup']") && !row("setup", "@me/gadget")?.querySelector("[data-badge='setup'], [data-note='setup']") && !stage("normal").querySelector("[data-badge='setup'], [data-note='setup'], [data-summary-setup]") && !within("setup", ".plugin-banner"), "Plugins that never report it, and one that is switched off, look as before; no banner is raised");
  await click(setupWeather.querySelector("[data-row-action='setup']"));
  await settle();
  const setupDetails = [...document.querySelectorAll<HTMLElement>("[data-plugin-detail='@fuyu/weather']")];
  const setupDetail = setupDetails[setupDetails.length - 1];
  check(setupDetails.length === 2 && setupDetail.querySelector("[data-tab='settings']")?.getAttribute("aria-selected") === "true", "Set up opens the plugin's detail on its settings tab");
  await click(setupDetail.querySelector("[data-tab='overview']"));
  check(setupDetail.querySelector("[data-note='setup']")?.textContent!.includes(SETUP_HINT[locale]), "and the overview carries the same line");
  await press(setupDetail, "Escape");
  await click(setupWeather.querySelector("[data-badge='setup']"));
  await settle();
  check(dialog("@fuyu/weather")?.querySelector("[data-tab='settings']")?.getAttribute("aria-selected") === "true" && document.querySelectorAll("[data-plugin-detail='@fuyu/weather']").length === 2, "The mark itself is a button to the same place");
  await press([...document.querySelectorAll<HTMLElement>("[data-plugin-detail='@fuyu/weather']")].pop()!, "Escape");

  const countdownName = within("setup", "[data-suggest='@fuyu/countdown'] b")!.textContent!;
  await click(within("setup", "[data-suggest='@fuyu/countdown'] [data-action='install-suggested']"));
  await settle();
  await click(document.querySelector("[data-install-modal='@fuyu/countdown'] [data-action='confirm-install']"));
  await settle();
  const toast = () => within("setup", "[data-installed-toast='@fuyu/countdown']");
  check(market.calls.some((call) => call.startsWith("install:@fuyu/countdown@")) && toast()?.textContent!.includes(t.installed.done(countdownName)) && !toast()?.querySelector("[data-action='toast-setup']"), "After an install a notice confirms it, with no set-up button while the plugin has not asked for one");
  await showView("setup", open([...NEEDS_SETUP, { ...COUNTDOWN, setup: { hint: COUNTDOWN_HINT } }]));
  check(toast()?.dataset.setup === "needed" && toast()?.textContent!.includes(COUNTDOWN_HINT[locale]) && toast()?.querySelector("[data-action='toast-setup']")?.textContent === t.setup.go, "Once the new plugin says it needs setup, the notice says what is missing and offers Set up");
  await click(toast()?.querySelector("[data-action='toast-setup']"));
  await settle();
  check(!toast() && dialog("@fuyu/countdown")?.querySelector("[data-tab='settings']")?.getAttribute("aria-selected") === "true", "which closes the notice and opens that plugin's settings");
  await press(dialog("@fuyu/countdown")!, "Escape");
  await showView("setup", open([PLUGIN.weather, { ...PLUGIN.local, setup: {} }, PLUGIN.clock, PLUGIN.gadget, COUNTDOWN]));
  check(!row("setup", "@fuyu/weather")?.querySelector("[data-badge='setup'], [data-note='setup']") && !row("setup", "@fuyu/countdown")?.querySelector("[data-badge='setup']") && within("setup", "[data-summary-setup]")?.textContent === t.summary.setup(1), "The mark goes away as soon as the plugin reports it is set up");
  await showView("setup", open(NEEDS_SETUP));
  delete market.installed["@fuyu/countdown"];
  await act(async () => { await windowServices.get(marketV1).setManualAllowed({ allowed: market.manualAllowed }); });
  await settle();

  await checkRoster({ check, click, settle, within, text: t.banners.roster });
  await checkBarUsage({ check, click, press, settle, within, all, dialog, opened, text: t.bar, plain: STAGES.filter((item) => !item.bar).map((item) => item.key) });

  const spills = [...gallery.querySelectorAll<HTMLElement>(".gallery__stage--narrow :is(.plugin-bar, .plugin-bar__row, .plugin-bar__actions, .plugin-row, .plugin-banner, .plugin-page__toolbar, .plugin-note, .plugin-page__summary, .plugin-row__facts, .plugin-suggest__grid, .plugin-suggest__card)")].filter((element) => element.scrollWidth > element.clientWidth + 1);
  check(spills.length === 0, spills.length ? `Narrow: ${spills.map((element) => element.className).join(", ")} spill out sideways at 340 px` : "Narrow: nothing spills out sideways at 340 px");

  results.textContent = messages.join("\n");
  document.documentElement.dataset.testResult = "passed";
} catch (error) {
  results.textContent = [...messages, `FAIL ${error instanceof Error ? error.message : String(error)}`].join("\n");
  document.documentElement.dataset.testResult = "failed";
}
