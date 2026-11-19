import { act, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles/tokens.css";
import "../../src/styles/fonts.css";
import "../../src/styles/base.css";
import "../../src/windows/settings/SettingsWindow.css";
import { ipc, locale, market, NORMAL, HOST } from "./pluginPageMocks";
import { I18nProvider, TRANSLATIONS } from "../../src/i18n";
import type { PluginHostConnector } from "../../src/windows/settings/usePluginHostStatus";

const { PluginMarketPage } = await import("../../src/windows/settings/PluginMarketPage");
const { PluginsV3SettingsPage } = await import("../../src/windows/settings/PluginsV3SettingsPage");
const { requestMarketView } = await import("../../src/windows/settings/pluginPageHandoff");

const text = TRANSLATIONS[locale].settings.pluginsV3;
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
const click = (element: Element | null | undefined) => act(async () => { if (!element) throw new Error("missing element to click"); (element as HTMLElement).click(); });
const press = (element: Element, key: string) => act(async () => { element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })); });
const type = async (input: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => { setter.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
};
const results = document.getElementById("results")!;

async function mount(key: string, title: string, node: ReactNode) {
  const host = document.createElement("section");
  host.className = "gallery__stage settings-stage";
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
  return { stage: host, unmount: () => act(async () => root.unmount()) };
}
const card = (stage: HTMLElement, name: string) => stage.querySelector<HTMLElement>(`[data-market-plugin='${name}']`);

try {
  ipc.pendingPackage = { fileName: "gadget.fuyu", base64: "AAAA" };
  const plugins = await mount("redirect", "打开 .fuyu 文件 / Opening a .fuyu file", <PluginsV3SettingsPage connect={connect} onOpenPage={(page) => opened.push(`plugins:${page}`)} />);
  check(opened.includes("plugins:pluginMarket"), "A .fuyu file sent to the plugin page moves on to the market page");
  await plugins.unmount();
  gallery.querySelector("[data-stage='redirect']")!.remove();

  const browse = await mount("browse", "插件市场 / Market", <PluginMarketPage connect={connect} onOpenPage={(page) => opened.push(`market:${page}`)} />);
  const fileModal = document.querySelector<HTMLElement>("[data-install-modal='@me/gadget']");
  check(fileModal && market.calls.includes("inspect") && fileModal.textContent!.includes(text.market.confirmModal.sourceManualWarn), "and the market page asks to confirm that package, warning it was not reviewed");
  await press(fileModal!, "Escape");
  await settle();
  check(!document.querySelector("[data-install-modal='@me/gadget']"), "Escape cancels the file install");

  const { stage } = browse;
  check(card(stage, "@fuyu/weather")?.textContent!.includes(text.market.officialBadge) && card(stage, "@someone/notes")?.textContent!.includes(text.market.cooldownBadge), "Market cards show the official badge and the calm new badge");
  check(card(stage, "@someone/old")?.textContent!.includes(text.market.needsFuyu(">=9.0.0")) && !card(stage, "@someone/old")?.querySelector("[data-action='market-install']"), "A plugin this Fuyu cannot run says which version it needs and has no install button");
  check(card(stage, "@fuyu/weather")?.querySelector("[data-action='market-manage']")?.textContent === text.market.manageBtn, "An installed plugin has a Manage button instead of a dead Installed label");
  check(!stage.querySelector("[data-action='market-install-file']"), "File install stays hidden until it is allowed");
  await click(stage.querySelector(".plugins-v3__manual-toggle input"));
  await settle();
  check(market.calls.includes("manual:true") && stage.querySelector("[data-action='market-install-file']"), "Allowing file installs reveals the file button");

  await type(stage.querySelector<HTMLInputElement>(".plugin-search input")!, "clock");
  check(stage.querySelectorAll("[data-market-plugin]").length === 1 && card(stage, "@someone/clock"), "Searching the market narrows the cards");
  await click(stage.querySelector(".plugin-search__clear"));
  check(stage.querySelectorAll("[data-market-plugin]").length === 8, "Clearing the search shows every card again");

  await click(card(stage, "@fuyu/weather"));
  await settle();
  const detail = document.querySelector<HTMLElement>("[data-market-detail-modal='@fuyu/weather']");
  check(detail?.textContent!.includes("Hourly forecast") && detail.textContent!.includes("MIT") && detail.querySelector("[data-market-likes='42']"), "A card opens the market detail with README, license and likes");
  await press(detail!, "Escape");
  check(!document.querySelector("[data-market-detail-modal='@fuyu/weather']"), "Escape closes it");

  await click(card(stage, "@someone/stocks")?.querySelector("[data-action='market-install']"));
  await settle();
  const install = document.querySelector<HTMLElement>("[data-install-modal='@someone/stocks']");
  check(install?.textContent!.includes(text.market.confirmModal.hostSecurityNote), "Install asks for confirmation and says what a plugin can reach");
  await click(install!.querySelector("[data-action='confirm-install']"));
  await settle(160);
  check(market.calls.includes("install:@someone/stocks@1.0.0") && card(stage, "@someone/stocks")?.querySelector("[data-action='market-manage']"), "Confirming installs it and the card switches to Manage");

  await click(card(stage, "@fuyu/weather")?.querySelector("[data-action='market-manage']"));
  check(opened.includes("market:pluginsV3"), "Manage goes back to the plugin page");
  await browse.unmount();
  stage.remove();
  const manage = await mount("manage", "从市场点「管理」/ Manage from the market", <PluginsV3SettingsPage connect={connect} onOpenPage={(page) => opened.push(`manage:${page}`)} />);
  const managed = document.querySelector<HTMLElement>("[data-plugin-detail='@fuyu/weather']");
  check(managed?.querySelector("[data-tab='overview']")?.getAttribute("aria-selected") === "true", "and the plugin page opens that plugin's detail");
  await press(managed!, "Escape");
  await manage.unmount();
  manage.stage.remove();

  requestMarketView({ detail: "@fuyu/countdown" });
  const deep = await mount("deep", "从迁移卡片进市场 / From the migration card", <PluginMarketPage connect={connect} />);
  check(document.querySelector("[data-market-detail-modal='@fuyu/countdown']"), "A market request from another page opens straight on that plugin");
  await press(document.querySelector("[data-market-detail-modal='@fuyu/countdown']")!, "Escape");
  await deep.unmount();
  deep.stage.remove();

  requestMarketView({ query: "notes" });
  const searched = await mount("market", "插件市场 / Market", <PluginMarketPage connect={connect} />);
  check(searched.stage.querySelector<HTMLInputElement>(".plugin-search input")?.value === "notes" && searched.stage.querySelectorAll("[data-market-plugin]").length === 1, "A search handed over from the plugin page is filled in");
  await click(searched.stage.querySelector(".plugin-search__clear"));

  results.textContent = messages.join("\n");
  document.documentElement.dataset.testResult = "passed";
} catch (error) {
  results.textContent = [...messages, `FAIL ${error instanceof Error ? error.message : String(error)}`].join("\n");
  document.documentElement.dataset.testResult = "failed";
}
