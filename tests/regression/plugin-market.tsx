import { act, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles/tokens.css";
import "../../src/styles/fonts.css";
import "../../src/styles/base.css";
import "../../src/windows/settings/SettingsWindow.css";
import { ipc, locale, market, NORMAL, HOST } from "./pluginPageMocks";
import { marketFixture, RSS_DETAILS, TOOLBOX_PACKAGE } from "./pluginMarketFixtures";
import { I18nProvider, TRANSLATIONS } from "../../src/i18n";
import type { PluginHostConnector } from "../../src/windows/settings/usePluginHostStatus";
import type { PluginMarketViewProps } from "../../src/windows/settings/PluginMarketView";

const { PluginMarketPage } = await import("../../src/windows/settings/PluginMarketPage");
const { PluginMarketView } = await import("../../src/windows/settings/PluginMarketView");
const { PluginMarketHeaderActions } = await import("../../src/windows/settings/PluginMarketHeaderActions");
const { PluginsV3SettingsPage } = await import("../../src/windows/settings/PluginsV3SettingsPage");
const { requestMarketView, requestPluginDetail } = await import("../../src/windows/settings/pluginPageHandoff");

const text = TRANSLATIONS[locale].settings.pluginsV3.marketPage;
const zh = locale === "zh-CN";
const connect: PluginHostConnector = (handlers) => {
  handlers.onState("open");
  handlers.onSnapshot({ plugins: NORMAL, host: HOST });
  return { close: () => undefined };
};

const opened: string[] = [];
const messages: string[] = [];
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
  messages.push(`PASS ${message}`);
};
const settle = (ms = 80) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });
const gallery = document.getElementById("gallery")!;
const results = document.getElementById("results")!;
const click = (element: Element | null | undefined) => act(async () => { if (!element) throw new Error("missing element to click"); (element as HTMLElement).click(); });
const press = (element: Element, key: string) => act(async () => { element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })); });
const type = async (input: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => { setter.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
};
const waitFor = async <T,>(find: () => T | null | undefined, what: string): Promise<T> => {
  for (let i = 0; i < 60; i += 1) {
    const found = find();
    if (found) return found;
    await settle(50);
  }
  throw new Error(`timed out waiting for ${what}`);
};

async function mount(key: string, title: string, node: ReactNode, narrow = false) {
  const host = document.createElement("section");
  host.className = `gallery__stage settings-stage${narrow ? " gallery__stage--narrow" : ""}`;
  host.dataset.stage = key;
  const heading = document.createElement("h2");
  heading.className = "gallery__title";
  heading.textContent = title;
  const body = document.createElement("div");
  host.append(heading, body);
  gallery.append(host);
  const root = createRoot(body);
  await act(async () => { root.render(<StrictMode><I18nProvider>{node}</I18nProvider></StrictMode>); });
  await settle(120);
  return { stage: host, unmount: async () => { await act(async () => root.unmount()); host.remove(); } };
}
const view = (key: string, title: string, props: Partial<PluginMarketViewProps> = {}, narrow = false) =>
  mount(key, title, <PluginMarketView host="open" snapshot={marketFixture()} onRefresh={() => market.calls.push("view-refresh")} onOpenPage={(page) => opened.push(`view:${page}`)} {...props} />, narrow);
const card = (stage: ParentNode, name: string) => stage.querySelector<HTMLElement>(`[data-market-plugin='${name}']`);
const modal = (selector: string) => waitFor(() => document.querySelector<HTMLElement>(selector), selector);
const cards = (stage: ParentNode, section: string) => [...stage.querySelectorAll(`[data-market-section='${section}'] [data-market-plugin]`)].map((item) => item.getAttribute("data-market-plugin"));

market.details["@fuyu/rss"] = RSS_DETAILS;

try {
  const browse = await view("browse", zh ? "浏览：可更新 + 全部" : "Browse: updates and all plugins");
  const { stage } = browse;
  check(!/v3|第 3 版/i.test(stage.textContent!), "The market page never mentions the plugin platform's version");
  check(stage.querySelector("[data-market-update='@fuyu/github-notify']") && stage.querySelector("[data-market-update='@lin-dev/pomo-stats']") && !card(stage, "@fuyu/github-notify"), "Plugins with an update are listed once, in the updates section");
  check(cards(stage, "all").length === 10 && !stage.querySelector("[data-market-section^='group:']"), "With All selected the rest is one flat list, not grouped by category");
  const grid = getComputedStyle(stage.querySelector(".market-grid")!).gridTemplateColumns.split(" ").length;
  check(grid === 2, `Cards sit two to a row (got ${grid})`);
  check(card(stage, "@fuyu/rss")?.textContent!.includes(text.card.official) && card(stage, "@ryo/clip-sync")?.textContent!.includes(text.card.fresh), "Cards show the official badge and the calm new badge");
  check(card(stage, "@fuyu/rss")?.querySelector(".market-card__facts")?.textContent === text.card.network && !/权限|permission/i.test(stage.querySelector(".market-grid")?.textContent ?? ""), "Cards say whether the plugin uses the network and never count permissions");
  check(card(stage, "@kai/vscode-status")?.textContent!.includes(text.card.needsFuyu(">=0.40.0")) && card(stage, "@kai/vscode-status")?.querySelector("[data-action='market-go-update']") && !card(stage, "@kai/vscode-status")?.querySelector("[data-action='market-install']"), "A plugin this Fuyu cannot run says which version it needs and offers to update Fuyu instead of installing");
  await click(card(stage, "@kai/vscode-status")?.querySelector("[data-action='market-go-update']"));
  check(opened.includes("view:about"), "Updating Fuyu opens the About page");
  check(card(stage, "@fuyu/weather")?.querySelector("[data-action='market-manage']"), "An installed plugin offers Manage");
  check(stage.querySelector("[data-market-section='updates']")?.compareDocumentPosition(stage.querySelector("[data-market-section='all']")!) === Node.DOCUMENT_POSITION_FOLLOWING, "Updates come before the full list");

  const narrow = await view("browse-narrow", zh ? "浏览（窄窗口）" : "Browse (narrow window)", {}, true);
  check(getComputedStyle(narrow.stage.querySelector(".market-grid")!).gridTemplateColumns.split(" ").length === 1, "A narrow window has one card per row");

  const search = await view("search", zh ? "搜索" : "Search", { initialQuery: "sync" });
  check(cards(search.stage, "results").sort().join() === "@fuyu/devices,@mio/focus-sync,@ryo/clip-sync,@tara/linear", "Searching matches names and descriptions and lists only those plugins under a result count");

  const none = await view("noresult", zh ? "搜索无结果" : "No results", { initialQuery: zh ? "股票行情" : "stock ticker" });
  check(none.stage.querySelector("[data-market-empty='no-result']") && none.stage.querySelector("[data-market-empty] [data-action='market-install-file']") && none.stage.querySelector("[data-market-empty] [data-market-category='productivity']"), "No results suggests categories, installing from a file and making your own");

  const category = await view("category", zh ? "分类筛选" : "Category filter");
  await click(category.stage.querySelector(".market-toolbar [data-market-category='productivity']"));
  check(category.stage.querySelector(".market-toolbar [data-market-category='productivity']")?.getAttribute("aria-pressed") === "true" && cards(category.stage, "category:productivity").length === 5, "Picking a category shows all of its plugins");

  const detail = await view("detail", zh ? "插件详情" : "Plugin detail", { initialDetail: "@fuyu/rss" });
  const rss = await waitFor(() => detail.stage.querySelector<HTMLElement>("[data-market-detail-modal='@fuyu/rss'] .market-markdown"), "the RSS readme")
    .then((node) => node.closest<HTMLElement>("[data-market-detail-modal]")!);
  check(rss.textContent!.includes(text.detail.likes(212)) && rss.textContent!.includes("MIT") && rss.querySelectorAll(".market-shot").length === 3, "The detail shows likes, license and screenshots");
  check(rss.querySelector("[data-market-link='repository']") && rss.querySelector("[data-action='market-install']"), "and links and an install button");
  check(rss.querySelector("[data-plugin-capabilities] [data-capability='network']") && rss.querySelector("[data-market-commands]") && !rss.querySelector("[data-detail-tab='permissions']"), "The overview lists what the plugin does and its commands, with no permissions tab");
  check(!/权限|permission/i.test(rss.textContent ?? ""), "and never talks about permissions");
  await click(rss.querySelector("[data-detail-tab='versions']"));
  check(rss.querySelectorAll("[data-market-version]").length === 3, "The versions tab lists every published version");
  await click(rss.querySelector("[data-detail-tab='readme']"));

  const narrowDetail = await view("detail-narrow", zh ? "插件详情（窄窗口）" : "Plugin detail (narrow window)", { initialDetail: "@fuyu/rss" }, true);
  await waitFor(() => narrowDetail.stage.querySelector("[data-market-detail-modal] .market-markdown"), "the narrow readme");

  const confirm = await view("confirm", zh ? "安装确认（第一次信任发布者）" : "Install (first plugin from a publisher)");
  await click(card(confirm.stage, "@ryo/clip-sync")?.querySelector("[data-action='market-install']"));
  const first = await modal("[data-install-modal='@ryo/clip-sync']");
  check(first.querySelector("[data-callout='first']") && first.querySelector("[data-callout='fresh']") && first.querySelector("[data-install-note]") && !first.querySelector("[data-capability]"), "Installing a first plugin from a publisher explains the trust and the waiting period, with one honest line instead of a list of abilities");
  check(!/权限|permission/i.test(first.textContent ?? ""), "and never talks about permissions");
  check(first.querySelector("[data-action='confirm-install']")?.textContent === text.confirm.confirmTrust, "and the button says you trust the publisher");

  const narrowConfirm = await view("confirm-narrow", zh ? "安装确认（窄窗口）" : "Install (narrow window)", {}, true);
  await click(card(narrowConfirm.stage, "@ryo/clip-sync")?.querySelector("[data-action='market-install']"));
  await modal("[data-stage='confirm-narrow'] [data-install-modal='@ryo/clip-sync']");

  const update = await view("update", zh ? "更新确认" : "Update");
  await click(update.stage.querySelector("[data-market-update='@fuyu/github-notify'] [data-action='market-update']"));
  const upd = await modal("[data-install-modal='@fuyu/github-notify']");
  check(upd.dataset.installKind === "update" && upd.textContent!.includes(text.confirm.securityNote) && upd.querySelector("[data-action='confirm-install']")?.textContent === text.confirm.confirmUpdate, "An update asks plainly and says what plugins can do");

  const trust = await view("trust", zh ? "更新确认（换了签名密钥）" : "Update (signing key changed)");
  await click(trust.stage.querySelector("[data-market-update='@lin-dev/pomo-stats'] [data-action='market-update']"));
  const key = await modal("[data-install-modal='@lin-dev/pomo-stats']");
  check(key.querySelector("[data-callout='key']") && key.querySelector("[data-action='confirm-install']")?.textContent === text.confirm.confirmKey, "An update signed with a new key says so before anything else");

  market.inspected = TOOLBOX_PACKAGE;
  await view("file", zh ? "从 .fuyu 文件安装" : "Install from a .fuyu file", { openedPackage: { seq: 1, fileName: "my-toolbox.fuyu", base64: "AAAA" }, onConsumePackage: () => undefined });
  const local = await modal("[data-install-modal='my-toolbox']");
  market.inspected = null;
  check(local.querySelector("[data-callout='unreviewed']") && local.querySelector(`.market-mono[title='${TOOLBOX_PACKAGE.sha256}']`) && local.querySelector("[data-callout='manual']"), "A local file is flagged unreviewed, shows its SHA-256 and says installing turns on manual installs");

  requestPluginDetail("@fuyu/weather");
  const manage = await mount("manage", "manage", <PluginsV3SettingsPage connect={connect} />);
  check(await modal("[data-plugin-detail='@fuyu/weather']"), "Manage opens the plugin's detail on the plugin page");
  await manage.unmount();

  const loading = await view("loading", zh ? "加载中" : "Loading", { host: "connecting", snapshot: null });
  check(loading.stage.querySelector("[data-market-loading]") && loading.stage.querySelector<HTMLInputElement>(".market-toolbar input")?.disabled, "While loading, skeleton cards show and the toolbar is disabled");

  const cached = await view("neterr", zh ? "网络出错（有缓存）" : "Network error (cached)", { snapshot: marketFixture({ error: "fetch failed: getaddrinfo ENOTFOUND plugins.fuyu.app" }) });
  check(cached.stage.querySelector("[data-market-cached] [data-action='market-retry']") && card(cached.stage, "@fuyu/rss"), "A refresh error keeps the cached list under a warning with a retry");
  await click(cached.stage.querySelector("[data-action='market-retry']"));
  check(market.calls.includes("view-refresh"), "Retry refreshes the index");

  const failed = await view("neterr2", zh ? "网络出错（没缓存）" : "Network error (no cache)", { snapshot: null, failure: "fetch failed: getaddrinfo ENOTFOUND plugins.fuyu.app" });
  check(failed.stage.querySelector("[data-market-empty='error'] [data-action='market-retry']") && failed.stage.querySelector("[data-market-empty='error'] [data-action='market-install-file']"), "With nothing cached, the error offers retry and installing from a file");

  await view("neterr2-narrow", zh ? "网络出错（窄窗口）" : "Network error (narrow window)", { snapshot: null, failure: "fetch failed: getaddrinfo ENOTFOUND plugins.fuyu.app" }, true);
  await view("empty-index", zh ? "索引是空的" : "Empty index", { snapshot: marketFixture({ plugins: [] }) });
  const off = await view("offline", zh ? "插件没开" : "Plugins off", { host: "off", snapshot: null });
  check(off.stage.querySelector("[data-market-empty='offline']"), "With the plugin host off, the market says so");

  ipc.pendingPackage = { fileName: "gadget.fuyu", base64: "AAAA" };
  const redirect = await mount("redirect", "redirect", <PluginsV3SettingsPage connect={connect} onOpenPage={(page) => opened.push(`plugins:${page}`)} />);
  check(opened.includes("plugins:pluginMarket"), "A .fuyu file sent to the plugin page moves on to the market page");
  await redirect.unmount();

  const live = await mount("live", "live", <><div className="gallery__head"><PluginMarketHeaderActions /></div><PluginMarketPage connect={connect} onOpenPage={(page) => opened.push(`market:${page}`)} /></>);
  const gadget = await modal("[data-install-modal='@me/gadget']");
  check(market.calls.includes("inspect") && gadget.querySelector("[data-callout='manual']"), "and the market page asks to confirm that package");
  await click(gadget.querySelector("[data-action='confirm-install']"));
  await settle(160);
  check(market.calls.includes("manual:true") && market.calls.includes(`installFile:${"b".repeat(64)}`) && !document.querySelector("[data-install-modal='@me/gadget']"), "Confirming a file turns on manual installs and installs exactly the inspected file");

  check(live.stage.querySelector(".gallery__head [data-action='market-install-file']")?.textContent === text.installFromFile, "Install from file lives in the page header");
  await click(live.stage.querySelector("[data-action='market-refresh']"));
  await settle();
  check(market.calls.includes("refresh"), "The header refresh button refreshes the index");

  await type(live.stage.querySelector<HTMLInputElement>(".market-toolbar input")!, "clock");
  check(cards(live.stage, "results").join() === "@someone/clock", "Searching the live market narrows the cards");
  await click(live.stage.querySelector(".plugin-search__clear"));

  await click(card(live.stage, "@fuyu/weather"));
  const weather = await modal("[data-market-detail-modal='@fuyu/weather']");
  await press(weather, "Escape");
  check(!document.querySelector("[data-market-detail-modal='@fuyu/weather']"), "Escape closes the detail");

  await type(live.stage.querySelector<HTMLInputElement>(".market-toolbar input")!, "stocks");
  await click(card(live.stage, "@someone/stocks")?.querySelector("[data-action='market-install']"));
  const stocks = await modal("[data-install-modal='@someone/stocks']");
  await press(stocks, "Escape");
  check(!document.querySelector("[data-install-modal='@someone/stocks']"), "Escape cancels an install");
  await click(card(live.stage, "@someone/stocks")?.querySelector("[data-action='market-install']"));
  await click((await modal("[data-install-modal='@someone/stocks']")).querySelector("[data-action='confirm-install']"));
  await settle(160);
  check(market.calls.includes("install:@someone/stocks@1.0.0") && card(live.stage, "@someone/stocks")?.querySelector("[data-action='market-manage']"), "Confirming installs it and the card switches to Manage");

  await click(live.stage.querySelector(".plugin-search__clear"));
  await click(card(live.stage, "@fuyu/weather")?.querySelector("[data-action='market-manage']"));
  check(opened.includes("market:pluginsV3"), "Manage goes to the plugin page");
  await live.unmount();

  requestMarketView({ detail: "@fuyu/countdown" });
  const deep = await mount("deep", "deep", <PluginMarketPage connect={connect} />);
  check(await modal("[data-market-detail-modal='@fuyu/countdown']"), "A market request from another page opens straight on that plugin");
  await deep.unmount();

  requestMarketView({ query: "notes" });
  const handed = await mount("handed", "handed", <PluginMarketPage connect={connect} />);
  check(handed.stage.querySelector<HTMLInputElement>(".market-toolbar input")?.value === "notes" && cards(handed.stage, "results").length === 1, "A search handed over from the plugin page is filled in");
  await handed.unmount();

  results.textContent = messages.join("\n");
  document.documentElement.dataset.testResult = "passed";
} catch (error) {
  results.textContent = [...messages, `FAIL ${error instanceof Error ? error.message : String(error)}`].join("\n");
  document.documentElement.dataset.testResult = "failed";
}
