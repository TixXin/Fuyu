import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles/tokens.css";
import "../../src/styles/fonts.css";
import "../../src/styles/base.css";
import { SettingsWindow } from "../../src/windows/settings/SettingsWindow";
import { DEFAULT_SETTINGS } from "../../src/features/appearance/settings";
import { entryOf, settingsCategoryFor, sidebarItemOf, type SettingsCategory } from "../../src/windows/settings/categories";
import { I18nProvider, LOCALE_STORAGE_KEY } from "../../src/i18n";
import { commands, keybindingCalls, mailCalls, marketInstalls, openedUrls, REPLY_MARKER, replyMarkerCalls, revokedPermissions } from "./settingsMocks";

const query = new URLSearchParams(location.search);
const automated = query.has("test");
Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: automated });
const original = new Map(Object.entries(localStorage).filter(([key]) => key.startsWith("fuyu-")));
const restore = () => {
  for (const key of Object.keys(localStorage).filter(key => key.startsWith("fuyu-"))) {
    if (!original.has(key)) localStorage.removeItem(key);
  }
  for (const [key, value] of original) localStorage.setItem(key, value);
};
window.addEventListener("beforeunload", restore);

localStorage.setItem(LOCALE_STORAGE_KEY, query.get("locale") === "en" ? "en" : "zh-CN");
if (automated) localStorage.setItem("fuyu-settings", JSON.stringify({ opacity: 60, carryOverIncompleteTodos: false }));
else localStorage.removeItem("fuyu-settings");
localStorage.setItem("fuyu-save-directory", "");
localStorage.setItem("fuyu-qq-notification-access-requested", "true");


const root = createRoot(document.getElementById("root")!);
const mount = () => root.render(<StrictMode><I18nProvider><SettingsWindow /></I18nProvider></StrictMode>);
const messages: string[] = [];
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
  messages.push(`PASS ${message}`);
};
const element = <T extends HTMLElement>(selector: string) => {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Missing ${selector}`);
  return found;
};
const click = async (selector: string) => {
  const target = element<HTMLButtonElement>(selector);
  await act(async () => { target.click(); });
};
const type = async (input: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => { setter.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
};
const texts = (selector: string) => [...document.querySelectorAll(selector)].map((found) => found.textContent ?? "").join("|");
const backButton = () => [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "返回插件列表");
const onPluginPage = () => Boolean(backButton());
const backToList = () => act(async () => { backButton()?.click(); });
const openPage = async (category: SettingsCategory) => {
  await click(`.settings-sidebar__item[data-category='${sidebarItemOf(category)}']`);
  if (entryOf(category)) await click(`.settings-tabs__tab[data-tab='${category}']`);
};
const categories = () =>
  [...document.querySelectorAll<HTMLElement>(".settings-sidebar__item[data-category]")].map(item => item.dataset.category!);

if (!automated) {
  mount();
  const page = settingsCategoryFor(query.get("page") ?? "");
  const openRequestedPage = () => {
    const item = document.querySelector<HTMLButtonElement>(`.settings-sidebar__item[data-category='${sidebarItemOf(page!)}']`);
    if (!item) {
      setTimeout(openRequestedPage, 20);
      return;
    }
    item.click();
    if (entryOf(page!)) setTimeout(() => document.querySelector<HTMLButtonElement>(`.settings-tabs__tab[data-tab='${page}']`)?.click(), 20);
  };
  if (page) openRequestedPage();
} else {
  try {
    await act(async () => { mount(); });
    check(categories().length > 0, "The sidebar lists the settings pages");

    const pages = [...categories(), "theme", "themeMarket", "agentSessions", "agentAlerts", "sounds", "agentApprovals", "agentConnect", "agentRemote"];
    for (const category of pages) {
      await openPage(category as SettingsCategory);
      const item = element(`.settings-sidebar__item[data-category='${sidebarItemOf(category as SettingsCategory)}']`);
      const panel = element(".editor-panel");
      check(item.getAttribute("aria-current") === "page" && (!entryOf(category as SettingsCategory) || element(".settings-tabs__tab--active").dataset.tab === category),
        `${category}: the sidebar marks the open page, and its tab is selected`);
      check(element(".settings-page__title").textContent === item.textContent, `${category}: the page title matches the sidebar`);
      check(panel.querySelector(".settings-group, .settings-section"), `${category}: the page has content`);
      check(panel.scrollWidth <= panel.clientWidth, `${category}: nothing overflows horizontally`);
    }

    await openPage("plugins");
    check(/^第三方（\d+）\|内置（\d+）$/.test(texts(".plugins-list__title")), "Installed plugins are grouped, third-party first, then built-in");
    const cardNames = () => texts(".plugins-list__grid .plugin-card__title strong");
    check(texts(".plugins-toolbar__filter .plugin-chip__count") === "3|2|0|1" && element<HTMLButtonElement>(".plugins-toolbar__filter[data-filter='updates']").disabled, "The installed list counts all, running, updates and plugins that need attention");
    await click(".plugins-toolbar__filter[data-filter='attention']");
    check(cardNames() === "broken.plugin" && document.querySelectorAll(".plugin-card--error").length === 1, "Needs attention shows just the broken plugin, marked as an error");
    await click(".plugins-toolbar__filter[data-filter='attention']");
    await type(element<HTMLInputElement>(".plugins-toolbar input"), "local api");
    check(cardNames() === "本地接口" && texts(".plugins-list__title") === "内置（1）", "Search finds installed plugins by their name in either language");
    await type(element<HTMLInputElement>(".plugins-toolbar input"), "");
    await act(async () => { document.querySelector<HTMLElement>(".plugins-list__grid .plugin-card--openable .plugin-card__title")?.click(); });
    check(onPluginPage(), "Clicking a plugin's card opens its page");
    await backToList();
    const runLine = [...document.querySelectorAll<HTMLElement>(".plugin-card__hint")].find((hint) => hint.textContent?.startsWith("内存"));
    check(runLine?.textContent === "内存 4.0 MB", "A plugin's card shows only the plugin's own memory, without the runtime");
    check(runLine && !runLine.hasAttribute("title"), "The run line has no hover tooltip");
    check([...document.querySelectorAll(".plugin-card__hint")].some((hint) => hint.textContent === "有预发布版本 v1.1.0-beta.1，可在插件设置里选择接收。"), "A plugin with a pre-release in the market says so on its card");
    const syncCard = [...document.querySelectorAll<HTMLElement>(".plugin-card")].find((card) => card.textContent?.includes("待办同步示例"));
    await act(async () => { [...(syncCard?.querySelectorAll<HTMLButtonElement>(".plugin-card__button") ?? [])].find((button) => button.textContent === "设置")?.click(); });
    const sensitiveRows = [...document.querySelectorAll<HTMLElement>(".plugin-detail__sensitive li")];
    const linkRow = sensitiveRows.find((row) => row.textContent?.includes("fuyu:// 链接"));
    check(sensitiveRows.length === 2 && linkRow?.querySelector("em")?.textContent === "已允许", "A plugin that lists onUri shows the remembered answer for links next to its sensitive permissions");
    await act(async () => { linkRow?.querySelector("button")?.click(); });
    check(revokedPermissions.includes("uri"), "Revoking the link answer forgets it like a sensitive permission");
    await backToList();

    await openPage("market");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
    const groupTitles = () => texts(".plugin-market__group-title");
    check(groupTitles() === "可更新（1）|可安装（1）", "Updates come first, then plugins that can be installed");
    check(document.querySelector(".plugin-market__header button")?.getAttribute("aria-label") === "刷新", "Refresh is a small icon button next to the status line");
    const marketItem = [...document.querySelectorAll<HTMLElement>(".plugin-market__item")].find((item) => item.textContent?.includes("待办同步示例"));
    const detailsButton = [...(marketItem?.querySelectorAll<HTMLButtonElement>("button[aria-expanded]") ?? [])][0];
    await act(async () => { detailsButton?.click(); });
    check(marketItem?.querySelector(".plugin-market__doc h3")?.textContent === "待办同步"
      && marketItem.querySelector(".plugin-market__doc strong")?.textContent === "5 分钟"
      && marketItem.querySelector(".plugin-market__doc a")?.getAttribute("href") === "https://example.com/docs"
      && marketItem.querySelectorAll(".plugin-market__doc li").length === 2,
      "The market details render the plugin's README");
    check(marketItem?.querySelector(".plugin-market__history summary")?.textContent === "版本历史"
      && marketItem.querySelector(".plugin-market__history h4")?.textContent === "1.1.0",
      "The market details show the plugin's version history");
    const tags = [...(marketItem?.querySelectorAll<HTMLElement>(".plugin-market__tag--signed") ?? [])];
    check(tags.length === 1 && tags[0].textContent === "作者已签名", "A plugin signed by its author is tagged in the market");
    check(marketItem?.querySelector(".plugin-card__hint--warn")?.textContent?.includes("签名密钥变了"), "An update on another author key says so");
    const marketButton = (label: string) => [...(marketItem?.querySelectorAll<HTMLButtonElement>(".plugin-market__action button") ?? [])].find((item) => item.textContent === label);
    await act(async () => { marketButton("仍然更新")?.click(); });
    check(marketInstalls.length === 0 && marketButton("确认更新") && marketButton("取消"), "Updating on another author key first asks to confirm");
    await act(async () => { marketButton("确认更新")?.click(); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    check(marketInstalls.length === 1 && marketInstalls[0].id === "dev.example.todo-sync" && marketInstalls[0].acceptKeyChange === true, "Confirming installs the update and accepts the new key");
    const verifiedBadges = [...document.querySelectorAll<HTMLElement>(".plugin-market__badge:not(.plugin-market__badge--official)")];
    check(verifiedBadges.length === 1 && verifiedBadges[0].textContent === "已验证"
      && verifiedBadges[0].closest(".plugin-market__item")?.textContent?.includes("新插件"),
      "A verified publisher gets a small mark; the official one keeps its own label");
    check(document.querySelectorAll("[title]").length === 0, "No hover tooltips anywhere in Settings");
    const verifiedItem = verifiedBadges[0]?.closest<HTMLElement>(".plugin-market__item");
    check(verifiedItem && verifiedItem.scrollWidth <= verifiedItem.clientWidth, "The verified mark does not make the market overflow");
    check(groupTitles() === "可安装（1）|已安装（1）" && !document.querySelector(".plugin-market__toggle")
      && document.querySelectorAll(".plugin-market__grid").length === 2, "Installed plugins are listed at once, last, cards in a grid (issue #16)");
    const categoryButton = (label: string) => [...document.querySelectorAll<HTMLButtonElement>(".plugin-market__category")].find((item) => item.textContent?.startsWith(label));
    await act(async () => { categoryButton("收藏")?.click(); });
    check(groupTitles() === "" && document.body.textContent?.includes("还没有收藏的插件"), "Starred with nothing starred says how to star");
    await act(async () => { categoryButton("全部")?.click(); });
    const star = document.querySelector<HTMLButtonElement>(".plugin-market__favorite[aria-pressed='false']");
    const starredName = star?.closest(".plugin-market__item")?.querySelector(".plugin-market__title strong")?.textContent ?? "";
    await act(async () => { star?.click(); });
    check(star?.getAttribute("aria-pressed") === "true" && star.getAttribute("aria-label") === `取消收藏 ${starredName}`
      && JSON.parse(localStorage.getItem("fuyu-plugin-market-favorites") ?? "[]").length === 1, "The star on a card saves the plugin on this computer");
    await act(async () => { categoryButton("收藏")?.click(); });
    check(categoryButton("收藏")?.textContent === "收藏 1" && document.querySelectorAll(".plugin-market__item").length === 1
      && document.querySelector(".plugin-market__title strong")?.textContent === starredName, "Starred shows just the starred plugin, with the count on the button");
    await act(async () => { document.querySelector<HTMLButtonElement>(".plugin-market__favorite")?.click(); });
    await act(async () => { categoryButton("全部")?.click(); });
    check(localStorage.getItem("fuyu-plugin-market-favorites") === null, "Unstarring the last plugin clears the saved list");
    const likeButtons = [...document.querySelectorAll<HTMLButtonElement>(".plugin-market__like")];
    check(likeButtons.map((button) => button.textContent).sort().join("|") === "12|3" && likeButtons.some((button) => button.getAttribute("aria-label") === "新插件：12 个赞，在 GitHub 上点赞")
      && document.querySelector(".plugin-market__sort"), "Cards show the likes from GitHub, and a sort menu appears with them (E14)");
    const opensBefore = openedUrls.length;
    await act(async () => { likeButtons.find((button) => button.textContent === "12")?.click(); });
    check(openedUrls.length === opensBefore + 1 && openedUrls[openedUrls.length - 1] === "https://github.com/TixXin/fuyu-plugins/discussions/9", "The like button opens the plugin's discussion");
    check(document.querySelector(".plugin-market__status")?.textContent?.startsWith("共 ") && !document.querySelector(".plugin-market__header > span:only-child"), "A status line with the plugin count takes the place of a second Plugin market title");
    const officialBadges = document.querySelectorAll(".plugin-market__badge--official");
    check(officialBadges.length > 0 && [...document.querySelectorAll(".plugin-market__meta")].every((meta) => !meta.textContent?.includes("· 官方")), "Official plugins carry one small mark instead of a publisher line");
    check([...document.querySelectorAll<HTMLElement>(".plugin-market__icon")].every((icon) => icon.textContent?.length === 1), "Every market card has a one-letter icon");
    const installedItem = document.querySelector<HTMLElement>(".plugin-market__installed")?.closest<HTMLElement>(".plugin-market__item");
    const manage = [...(installedItem?.querySelectorAll<HTMLButtonElement>(".plugin-market__action button") ?? [])].find((button) => button.textContent === "管理");
    const managedName = installedItem?.querySelector(".plugin-market__title strong")?.textContent ?? "";
    await act(async () => { manage?.click(); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    check(Boolean(manage) && onPluginPage()
      && document.body.textContent?.includes(managedName),
      "An installed plugin shows Installed with Manage, which opens it on the plugins page");
    await backToList();

    await openPage("shortcuts");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
    const pluginRows = [...document.querySelectorAll<HTMLElement>(".shortcut-row")].filter((row) => row.textContent?.includes(" · "));
    const syncRow = pluginRows.find((row) => row.textContent?.includes("立即同步 · 待办同步示例"));
    const tokenRow = pluginRows.find((row) => row.textContent?.includes("重新生成令牌 · 本地接口"));
    check(syncRow?.querySelector(".shortcut-control__meta strong")?.textContent === "Ctrl+Alt+S" && !tokenRow, "Settings > Shortcuts lists the commands of third-party plugins that are on, with the manifest's shortcut; built-in ones are left out");
    await act(async () => { syncRow?.querySelector<HTMLButtonElement>("button[aria-label^='关闭这个快捷键']")?.click(); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    check(keybindingCalls.length === 1 && keybindingCalls[0].id === "dev.example.todo-sync" && keybindingCalls[0].command === "sync-now" && keybindingCalls[0].keybinding === "",
      "Turning a plugin shortcut off saves an empty shortcut for that command");
    const finder = element<HTMLButtonElement>("button[aria-label='按键查询']");
    await act(async () => { finder.click(); });
    await act(async () => { finder.dispatchEvent(new KeyboardEvent("keydown", { key: "t", ctrlKey: true, altKey: true, bubbles: true })); });
    check(element(".shortcut-finder__result").textContent?.startsWith("Ctrl+Alt+T 已用于「翻译选中文字」（翻译）"), "The key finder names the shortcut that uses the pressed keys and its page");
    await act(async () => { element<HTMLButtonElement>(".shortcut-finder__result .settings-link-button").click(); });
    const translationRows = texts(".settings-group__card > .shortcut-row .shortcut-control__meta span");
    check(element(".settings-page__title").textContent === "翻译" && translationRows === "打开快捷翻译|翻译选中文字",
      "Its link opens the Translation page, where the same shortcuts are recorded in place");
    await act(async () => { [...document.querySelectorAll<HTMLButtonElement>(".settings-group__header .settings-link-button")].find((link) => link.textContent === "全部快捷键 ›")?.click(); });
    check(element(".settings-page__title").textContent === "快捷键", "A feature page's shortcut group links back to all shortcuts");
    await openPage("behavior");
    check(texts(".settings-tabs__tab") === "展开与收起|贴边隐藏|系统提示" && !texts(".settings-group__title").includes("页面切换") && texts(".settings-cards__label") === "点击|鼠标悬停", "Behavior has three tabs; opening is chosen from two picture cards, and page keys are no longer repeated here");
    await act(async () => { [...document.querySelectorAll<HTMLButtonElement>(".settings-link-button")].find((link) => link.textContent === "去设置")?.click(); });
    check(element(".settings-tabs__tab--active").dataset.tab === "shortcutsIsland" && texts(".settings-group__title").includes("页面切换") && document.querySelectorAll(".shortcut-sheet .settings-group").length >= 2
      && texts(".shortcut-record-button .shortcut-keys__cap").startsWith("Alt|1–9"), "Its link opens Shortcuts > On the island: page keys on top as key caps, fixed keys in a two-column sheet");
    await openPage("behaviorAlerts");
    check(texts(".settings-group__title") === "在小岛上提示" && texts(".settings-row__title") === "音量与亮度|耳机与充电|摄像头和麦克风使用提示", "Volume, headphones and camera alerts are one group on the System alerts tab");
    await openPage("general");
    check(texts(".settings-group__title") === "启动与语言|位置|数据" && document.querySelector(".position-diagram__screen--active .position-diagram__island") && !texts(".settings-row__title").includes("最小化按钮")
      && document.querySelectorAll(".settings-footnote__toggle").length === 3, "General is three groups: the position group draws the screens, data folder and backup are one group, long notes fold");

    const storedSettings = () => JSON.parse(localStorage.getItem("fuyu-settings") ?? "{}") as { opacity?: number; carryOverIncompleteTodos?: boolean };
    check(!document.querySelector(".appearance-reset"), "Reset appearance is not offered outside the theme page");
    await openPage("appearance");
    check(document.querySelector(".collapsed-items") && !document.querySelector(".preset-name-input"),
      "Appearance keeps sizes and the collapsed bar; the look and the saved themes moved to Theme (C26)");
    const layoutReset = () => [...document.querySelectorAll<HTMLButtonElement>(".appearance-reset")].find((button) => button.textContent === "恢复默认外观");
    const stored = () => JSON.parse(localStorage.getItem("fuyu-settings") ?? "{}") as { opacity?: number; showTitle?: boolean };
    const before = stored();
    await act(async () => { layoutReset()!.click(); });
    await click(".appearance-reset--danger");
    check(stored().opacity === before.opacity && stored().showTitle === DEFAULT_SETTINGS.showTitle, "Appearance has its own reset, for sizes and display only");
    await openPage("theme");
    await click(".appearance-reset");
    check(storedSettings().opacity === 60, "The first reset click only asks for confirmation");
    await click(".appearance-reset__confirm .appearance-reset:not(.appearance-reset--danger)");
    check(storedSettings().opacity === 60 && document.querySelector(".appearance-reset"), "Cancelling keeps the appearance");
    await click(".appearance-reset");
    await click(".appearance-reset--danger");
    check(storedSettings().opacity === DEFAULT_SETTINGS.opacity, "Confirming resets the appearance");
    check(storedSettings().carryOverIncompleteTodos === false, "Resetting the appearance keeps todo settings");
    check(!document.querySelector(".island-preview__island--glass"), "The island preview starts classic");
    const glassButton = [...document.querySelectorAll<HTMLButtonElement>(".editor-panel button")].find((button) => button.textContent === "液态玻璃");
    await act(async () => { glassButton!.click(); });
    check(document.querySelectorAll(".island-preview__island--glass").length === 2, "Choosing liquid glass shows on both preview islands");
    await openPage("appearance");
    const zoneRows = (name: string) => [...(document.querySelector(`.collapsed-items__zone[aria-label="${name}"]`)?.querySelectorAll(".plugin-pages__name") ?? [])].map((row) => row.textContent);
    const itemButton = (label: string) => document.querySelector<HTMLButtonElement>(`.collapsed-items button[aria-label="${label}"]`);
    const savedItems = () => JSON.parse(localStorage.getItem("fuyu-collapsed-items") ?? "null") as { items: { id: string; zone: string; hidden?: boolean }[] } | null;
    check(zoneRows("左侧").join("|") === "Agent 状态灯" && zoneRows("右侧")[0] === "新邮件提醒" && zoneRows("右侧").includes("待办同步示例")
      && zoneRows("右侧")[zoneRows("右侧").length - 1] === "会话数 / 会话环" && savedItems() === null, "The collapsed bar items list the default layout, plugin status items included, without saving anything");
    await act(async () => { itemButton("移到左侧：会话数 / 会话环")!.click(); });
    await act(async () => { itemButton("上移：会话数 / 会话环")!.click(); });
    check(zoneRows("左侧").join("|") === "会话数 / 会话环|Agent 状态灯" && savedItems()?.items[0].id === "session-count", "An item moves to the other side and up, and the order is saved");
    await act(async () => { document.querySelector<HTMLElement>(".collapsed-items__zone[aria-label='左侧'] li:nth-child(2) .toggle-control, .collapsed-items__zone[aria-label='左侧'] li:nth-child(2) [role='switch']")?.click(); });
    check(savedItems()?.items.find((item) => item.id === "status-light")?.hidden === true, "The status light can be hidden");
    await act(async () => { [...document.querySelectorAll<HTMLButtonElement>(".collapsed-items__reset")][0].click(); });
    check(savedItems() === null && zoneRows("左侧").join("|") === "Agent 状态灯", "Reset to default clears the saved order");

    await openPage("themeMarket");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
    const card = (id: string) => document.querySelector<HTMLElement>(`.theme-market__item[data-theme-id="${id}"]`)!;
    const cardButton = (id: string, label: string) => [...card(id).querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === label);
    check(document.querySelectorAll(".theme-market__item").length === 2 && card("focusd.midnight").querySelector(".island-preview--compact")
      && card("focusd.midnight").querySelector(".plugin-market__badge--official") && card("someone.dusk").textContent?.includes("作者 someone"),
      "The theme market lists each theme with a preview, Official for the island's own");
    const scaleBefore = JSON.parse(localStorage.getItem("fuyu-settings") ?? "{}").collapsedScale;
    await act(async () => { cardButton("someone.dusk", "应用")!.click(); });
    const afterApply = JSON.parse(localStorage.getItem("fuyu-settings") ?? "{}") as { islandBackgroundColor?: string; collapsedScale?: number };
    check(afterApply.islandBackgroundColor === "#1b1020" && afterApply.collapsedScale === scaleBefore && cardButton("someone.dusk", "使用中")?.disabled,
      "Apply changes the look, not the size, and the card says it is in use");
    await act(async () => { cardButton("focusd.midnight", "保存到我的主题")!.click(); });
    check(cardButton("focusd.midnight", "已保存")?.disabled && (localStorage.getItem("fuyu-setting-presets") ?? "").includes("午夜蓝"),
      "Save adds the theme to the saved themes");

    await openPage("music");
    const waveRow = [...document.querySelectorAll<HTMLElement>(".settings-row")].find((row) => row.querySelector(".settings-row__title")?.textContent === "在收起的岛上显示音乐波形");
    const waveSwitch = () => waveRow?.querySelector<HTMLInputElement>("input");
    check(waveSwitch()?.checked === true && savedItems() === null, "The music wave shows on the collapsed bar by default");
    await act(async () => { waveSwitch()!.click(); });
    check(waveSwitch()?.checked === false && savedItems()?.items.find((item) => item.id === "music")?.hidden === true, "Turning the music wave off hides the bar's music item");
    await act(async () => { waveSwitch()!.click(); });
    check(waveSwitch()?.checked === true && !savedItems()?.items.find((item) => item.id === "music")?.hidden, "Turning it on shows it again");
    localStorage.removeItem("fuyu-collapsed-items");

    await openPage("behaviorTuck");
    const holdRow = (title: string) => [...document.querySelectorAll<HTMLElement>(".settings-row")].find((row) => row.querySelector(".settings-row__title")?.textContent === title)?.querySelector<HTMLInputElement>("input");
    check(!holdRow("有正在进行的待办时不收起"), "Idle tuck holds are hidden while idle tuck is off");
    await act(async () => { holdRow("闲置时贴边隐藏")!.click(); });
    check(holdRow("有正在进行的待办时不收起")?.checked === true && holdRow("Agent 在等你时不收起")?.checked === true && holdRow("音乐播放中不收起")?.checked === false,
      "Idle tuck holds: todo and agent on, music off by default");
    const tuckedHover = [...document.querySelectorAll<HTMLElement>(".settings-row")].find((row) => row.querySelector(".settings-row__title")?.textContent === "鼠标移到隐藏的岛上");
    const tuckedHoverButton = (label: string) => [...(tuckedHover?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find((button) => button.textContent === label);
    check(tuckedHoverButton("只露出岛屿")?.getAttribute("aria-pressed") === "true", "Hovering a tucked island only slides it out by default");
    await act(async () => { tuckedHoverButton("展开面板")?.click(); });
    check((JSON.parse(localStorage.getItem("fuyu-settings") ?? "{}") as { tuckedHoverAction?: string }).tuckedHoverAction === "expand"
      && tuckedHoverButton("展开面板")?.getAttribute("aria-pressed") === "true",
      "Choosing to open the panel from a tucked island is saved");
    check(tuckedHover && tuckedHover.scrollWidth <= tuckedHover.clientWidth, "The tucked-hover choice fits its row");

    const agentPolls = () => commands.filter(command => command === "get_agent_status").length;
    const pollsAway = agentPolls();
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 1_200)); });
    check(agentPolls() === pollsAway, "Agent status is not polled while its page is closed");

    await act(async () => {
      localStorage.setItem("fuyu-settings-focus", JSON.stringify({ section: "savePath", requestedAt: Date.now() }));
      window.dispatchEvent(new StorageEvent("storage", { key: "fuyu-settings-focus", newValue: "x", storageArea: localStorage }));
    });
    check(element(".settings-sidebar__item[data-category='todos']").getAttribute("aria-current") === "page", "A save path request from the island opens the todos page");
    check(document.querySelector(".editor-panel .save-path-panel--attention"), "A save path request from the island highlights the save path");
    await click(".save-path-panel .settings-link-button");
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 1_500)); });
    check(document.querySelector(".save-path-panel .save-path-saved"), "The saved confirmation stays long enough to notice");

    await openPage("messages");
    const rows = () => [...document.querySelectorAll<HTMLElement>(".mail-settings__account")];
    check(rows().length === 2 && rows()[0].textContent?.includes("demo@qq.com"), "The mail page lists every mailbox");
    const rowButton = (row: number, text: string) => [...rows()[row].querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.includes(text));
    await act(async () => { rowButton(1, "重新授权")!.click(); });
    const formEmail = () => element<HTMLInputElement>(".mail-settings__form input[type='email']");
    check(formEmail().value === "louis@163.com" && formEmail().disabled && !document.querySelector(".mail-settings__form input[type='text']"),
      "Re-authorizing fixes the address and hides the server field");
    await act(async () => { [...document.querySelectorAll<HTMLButtonElement>(".mail-settings__form button")].find((button) => button.textContent === "取消")!.click(); });
    await act(async () => { rowButton(0, "断开")!.click(); });
    check(!mailCalls.some((call) => call.command === "disconnect_qq_mail") && document.querySelector(".mail-settings__confirm"), "The first disconnect click only asks for confirmation");
    await act(async () => { rowButton(0, "确认断开")!.click(); });
    check(mailCalls.some((call) => call.command === "disconnect_qq_mail" && call.args.email === "demo@qq.com") && rows().length === 1,
      "Confirming disconnects and removes the mailbox");
    await type(formEmail(), "new@example.edu.cn");
    await type(element<HTMLInputElement>(".mail-settings__form input[type='password']"), "code");
    await type(element<HTMLInputElement>(".mail-settings__form input[type='text']"), "imap.example.edu.cn");
    await act(async () => { element<HTMLButtonElement>(".mail-settings__form button[type='submit']").click(); });
    check(mailCalls.some((call) => call.command === "connect_qq_mail" && call.args.host === "imap.example.edu.cn") && rows().length === 2,
      "Adding a mailbox sends the typed server and lists it");
    const saved = JSON.parse(localStorage.getItem("fuyu-qq-mail-settings") ?? "{}") as { accounts?: { email: string; host: string }[] };
    check(saved.accounts?.some((account) => account.email === "new@example.edu.cn" && account.host === "imap.example.edu.cn"),
      "The typed server is saved with the mailbox");

    await openPage("agentConnect");
    check(texts(".settings-tabs__tab") === "岛上显示|会话列表|提醒|声音|审批|连接|SSH 远程" && texts(".settings-page__title") === "AI Agent"
      && element(".settings-sidebar__item--active").dataset.category === "agents",
      "AI Agent is one sidebar item whose page has tabs for on the island, session list, alerts, sounds, approvals, connection and SSH remote");
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
    check(agentPolls() > pollsAway, "The connection page reads the agents' state");
    const connectGroups = [...document.querySelectorAll<HTMLElement>(".settings-group")];
    const markerGroup = connectGroups.find((group) => group.textContent?.includes("回复状态标记"));
    check(markerGroup && connectGroups[connectGroups.indexOf(markerGroup) - 1]?.textContent?.includes("安装/修复") && markerGroup.textContent!.includes("推荐打开"),
      "The reply status marker follows the hooks on the connection page and is marked as recommended");
    const markerSwitch = markerGroup?.querySelector<HTMLInputElement>("[role='switch']");
    check(markerSwitch && !markerSwitch.checked && markerGroup!.textContent!.includes(REPLY_MARKER.path) && markerGroup!.querySelector("pre")?.textContent === REPLY_MARKER.content,
      "The reply status marker is off by default and shows the rules file and the text it would write");
    await act(async () => { markerSwitch!.click(); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
    check(replyMarkerCalls.join() === "true" && markerSwitch!.checked, "Switching the reply status marker on writes it");

    await openPage("agentRemote"); await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
    check(/devbox.*nas/s.test(element(".editor-panel").textContent ?? ""), "The remote computers page lists the SSH hosts to read sessions from");
    await openPage("agents"); await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
    const hooksLink = [...document.querySelectorAll<HTMLButtonElement>(".editor-panel .settings-link-button")].find((button) => button.textContent === "安装/修复");
    check(hooksLink, "Without hooks, the on-the-island page says so with a way to install them");
    await act(async () => { hooksLink!.click(); });
    check(element(".settings-tabs__tab--active").dataset.tab === "agentConnect", "The hooks notice on the on-the-island page opens the connection page");
    await openPage("agentSessions");
    const filterGroup = () => [...document.querySelectorAll<HTMLElement>(".settings-group")].find((group) => group.textContent?.includes("隐藏会话"))!;
    localStorage.removeItem("fuyu-agent-session-filters");
    const filterInput = filterGroup().querySelector<HTMLInputElement>(".session-filter__form input")!;
    await type(filterInput, "E:\\Projects\\scratch");
    await act(async () => { filterGroup().querySelector<HTMLFormElement>(".session-filter__form")!.requestSubmit(); });
    const savedFilters = JSON.parse(localStorage.getItem("fuyu-agent-session-filters") ?? "[]") as { kind: string; value: string }[];
    check(savedFilters.length === 1 && savedFilters[0].kind === "folder" && savedFilters[0].value === "E:\\Projects\\scratch" && filterInput.value === ""
      && filterGroup().querySelector(".session-filter__value")?.textContent === "E:\\Projects\\scratch", "Adding a hide-sessions rule saves and lists it");
    await act(async () => { filterGroup().querySelector<HTMLButtonElement>(".session-filter__remove")!.click(); });
    check(localStorage.getItem("fuyu-agent-session-filters") === "[]" && !filterGroup().querySelector(".session-filter__value"), "Removing the rule clears it");

    await openPage("about");
    const hero = element(".about-hero");
    check(hero.querySelector(".about-hero__name")?.textContent === "浮屿" && hero.getBoundingClientRect().height >= hero.scrollHeight - 1,
      "About opens with the app's hero card, not clipped");
    check(document.querySelectorAll(".about-links .project-link").length === 4
      && texts(".settings-group__title").includes("帮助|重置与退出"), "Links are four tiles; help, then reset and quit, come last");
    const aboutLink = (label: string) =>
      [...document.querySelectorAll<HTMLButtonElement>(".settings-link-button")].find((button) => button.textContent === label);
    await act(async () => { aboutLink("重置")!.click(); });
    check(aboutLink("确认重置") && aboutLink("取消"), "Reset all settings asks first");
    check(storedSettings().carryOverIncompleteTodos === false, "Asking changes nothing yet");
    await act(async () => { aboutLink("确认重置")!.click(); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
    check(storedSettings().carryOverIncompleteTodos === DEFAULT_SETTINGS.carryOverIncompleteTodos && !aboutLink("确认重置"),
      "Confirming resets every setting, not just the appearance");
    await act(async () => { aboutLink("退出")!.click(); });
    check(commands.includes("quit_island"), "Quit asks the island to exit");

    await act(async () => { root.unmount(); });
    document.documentElement.dataset.testResult = "passed";
  } catch (error) {
    document.documentElement.dataset.testResult = "failed";
    messages.push(`FAIL ${String(error)}`);
    console.error(error);
  } finally {
    restore();
    document.getElementById("results")!.textContent = messages.join("\n");
  }
}
