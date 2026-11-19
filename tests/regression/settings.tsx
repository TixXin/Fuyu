import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles/tokens.css";
import "../../src/styles/fonts.css";
import "../../src/styles/base.css";
import { SettingsWindow } from "../../src/windows/settings/SettingsWindow";
import { DEFAULT_SETTINGS } from "../../src/lib/settings/settings";
import { entryOf, settingsCategoryFor, sidebarItemOf, type SettingsCategory } from "../../src/windows/settings/categories";
import { I18nProvider, LOCALE_STORAGE_KEY } from "../../src/i18n";
import { checkGlassLooks } from "./settings-glass-looks";
import { checkIdleDimSettings } from "./settings-idle-dim";
import { checkLocalApiNotify } from "./settings-local-api";
import { checkNotchPreview } from "./settings-notch-preview";
import { checkAgentNoticeSettings } from "./settings-agent-notice";
import { checkMessageNotice, checkMessageSources } from "./settings-im-sources";
import { checkThemeMarket } from "./settings-theme-market";
import { commandsV1 } from "@fuyu/plugin-services";
import { windowServices } from "../../src/features/plugin-kernel/services";
import { commands, mailCalls, REPLY_MARKER, replyMarkerCalls } from "./settingsMocks";

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


const commandItems = [
  { pluginId: "dev.example.todo-sync", pluginName: { "zh-CN": "待办同步示例", en: "Todo sync example" }, id: "sync-now", title: { "zh-CN": "立即同步", en: "Sync now" }, defaultKeybinding: "Ctrl+Alt+S", keybinding: "Ctrl+Alt+S", active: true, conflicts: [] },
];
const commandKeybindingCalls: { plugin: string; command: string; keybinding: string | null }[] = [];
windowServices.provide(commandsV1, {
  list: () => ({ items: commandItems.map((item) => ({ ...item })) }),
  run: () => null,
  setKeybinding: (params) => {
    commandKeybindingCalls.push(params);
    return { items: commandItems.map((item) => ({ ...item, keybinding: params.keybinding === "" ? null : params.keybinding })) };
  },
}, { owner: "settings-regression" });

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
const settingRow = (title: string) => [...document.querySelectorAll<HTMLElement>(".settings-row")].find((row) => row.querySelector(".settings-row__title")?.textContent === title);
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

    const pages = [...categories(), "generalData", "generalSync", "theme", "themeStyle", "appearance", "appearanceCollapsed", "behaviorTuck", "shortcutsIsland", "shortcutsReference", "musicLyrics", "musicLyricsStyle", "clipboardHistory", "clipboardSnippets", "timerAlerts", "behaviorAlerts", "messagesIm", "agentConnect", "agentApprovals", "agentAppearance", "agentSessions", "agentRings", "agentAlerts", "sounds", "agentPush", "agentRemote"];
    for (const category of pages) {
      await openPage(category as SettingsCategory);
      const item = element(`.settings-sidebar__item[data-category='${sidebarItemOf(category as SettingsCategory)}']`);
      const panel = element(".editor-panel");
      check(item.getAttribute("aria-current") === "page" && (!entryOf(category as SettingsCategory) || element(".settings-tabs__tab--active").dataset.tab === category),
        `${category}: the sidebar marks the open page, and its tab is selected`);
      check(element(".settings-page__title").textContent === item.textContent, `${category}: the page title matches the sidebar`);
      check(panel.querySelector(".settings-group, .settings-section, .plugin-page"), `${category}: the page has content`);
      check(panel.scrollWidth <= panel.clientWidth, `${category}: nothing overflows horizontally`);
    }

    await openPage("shortcuts");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
    const pluginRows = [...document.querySelectorAll<HTMLElement>(".shortcut-row")].filter((row) => row.textContent?.includes(" · "));
    const syncRow = pluginRows.find((row) => row.textContent?.includes("立即同步 · 待办同步示例"));
    const tokenRow = pluginRows.find((row) => row.textContent?.includes("重新生成令牌 · 本地接口"));
    check(syncRow?.querySelector(".shortcut-control__meta strong")?.textContent === "Ctrl+Alt+S" && !tokenRow, "Settings > Shortcuts lists the commands of third-party plugins that are on, with the manifest's shortcut; built-in ones are left out");
    await act(async () => { syncRow?.querySelector<HTMLButtonElement>("button[aria-label^='关闭这个快捷键']")?.click(); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    check(commandKeybindingCalls.length === 1 && commandKeybindingCalls[0].plugin === "dev.example.todo-sync" && commandKeybindingCalls[0].command === "sync-now" && commandKeybindingCalls[0].keybinding === "",
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
    check(texts(".settings-tabs__tab") === "展开与收起|贴边隐藏" && !texts(".settings-group__title").includes("页面切换") && texts(".settings-cards__label") === "点击|鼠标悬停", "Behavior has two tabs; opening is chosen from two picture cards, and page keys are no longer repeated here");
    const leaveSwitch = () => settingRow("鼠标移开后自动收起")?.querySelector<HTMLInputElement>("input");
    check(leaveSwitch()?.checked === false && !settingRow("鼠标移开后收起前等待"), "Click mode offers close-on-leave, off by default without the delay slider");
    await act(async () => { leaveSwitch()!.click(); }); check(leaveSwitch()?.checked === true && Boolean(settingRow("鼠标移开后收起前等待")) && (JSON.parse(localStorage.getItem("fuyu-settings") ?? "{}") as { clickCollapseOnLeave?: boolean }).clickCollapseOnLeave === true, "Turning close-on-leave on saves it and shows the collapse delay slider"); await act(async () => { leaveSwitch()!.click(); });
    await act(async () => { [...document.querySelectorAll<HTMLButtonElement>(".settings-link-button")].find((link) => link.textContent === "去设置")?.click(); });
    check(element(".settings-tabs__tab--active").dataset.tab === "shortcutsIsland" && texts(".settings-group__title").includes("页面切换") && texts(".shortcut-record-button .shortcut-keys__cap").startsWith("Alt|1–9"), "Its link opens Shortcuts > On the island: page keys on top as key caps");
    await openPage("shortcutsReference"); check(document.querySelectorAll(".shortcut-sheet .settings-group").length >= 2, "Shortcuts > Reference shows fixed keys in a two-column sheet");
    await openPage("timerAlerts"); check(texts(".settings-tabs__tab") === "计时与休息|系统提示" && texts(".settings-group__title") === "计时器|休息提醒" && texts(".settings-row__title") === "到点响一声|休息提醒" && !document.querySelector(".break-reminder-row"), "Timer & alerts has two tabs starting with the timer's sound and break reminders");
    await openPage("behaviorAlerts"); check(texts(".settings-group__title") === "在小岛上提示" && texts(".settings-row__title") === "音量与亮度|耳机与充电|摄像头和麦克风使用提示", "Volume, headphones and camera alerts are one group on the System alerts tab");
    await openPage("general"); check(texts(".settings-group__title") === "启动与语言" && !texts(".settings-row__title").includes("最小化按钮") && !texts(".settings-tabs__tab").includes("本机接口"), "General opens on startup and language, without a Local API tab");
    await openPage("generalData"); check(texts(".settings-group__title") === "数据|升级前的备份" && texts(".settings-row__title").includes("0.3.9 → 0.4.0") && !document.querySelector(".settings-backup__status--error"), "Data and backup tab shows data folder, backup and pre-update backups");
    await openPage("generalApi");
    const localApi = [...document.querySelectorAll<HTMLElement>(".settings-group")].find((group) => group.textContent?.startsWith("本机接口")); await act(async () => { [...(localApi?.querySelectorAll<HTMLButtonElement>(".settings-row") ?? [])].find((row) => row.textContent?.startsWith("访问令牌"))?.querySelector("button")?.click(); });
    check(Boolean(localApi?.textContent?.includes("http://127.0.0.1:39271/v1")) && commands.includes("copy_local_api_token") && !/[0-9a-f]{64}/.test(localApi?.textContent ?? ""), "The local API group shows the address, copies the token through Rust and never shows it");
    check(categories().includes("generalApi") && element(".settings-sidebar__item[data-category='generalApi']").closest(".settings-sidebar__group")?.querySelector<HTMLElement>("[data-group]")?.dataset.group === "extensions" && !document.querySelector(".settings-tabs__tab"),
      "The local API is its own sidebar page in the Extensions group, with no tabs");
    const localApiRows = texts(".settings-row__title");
    check(texts(".settings-group__title") === "本机接口|权限|试一下" && ["待办和每日笔记", "AI Agent 状态灯", "剪贴板历史"].every((title) => localApiRows.includes(title)),
      "The page has three groups: the connection, what is open through it, and an example to try");
    const example = element(".local-api-example__code").textContent ?? "";
    check(example.includes("local-api.json") && example.includes("http://127.0.0.1:39271/v1/health") && !/[0-9a-f]{64}/.test(element(".editor-panel").textContent ?? ""),
      "The example reads the token from the config file and calls the health route; the page never shows the token");
    await checkLocalApiNotify(check);

    const storedSettings = () => JSON.parse(localStorage.getItem("fuyu-settings") ?? "{}") as { opacity?: number; carryOverIncompleteTodos?: boolean; autoTuckHoldMusic?: boolean; autoTuckHoldMessages?: boolean };
    check(!document.querySelector(".appearance-reset"), "Reset appearance is not offered outside the theme page");
    await openPage("appearance"); check(document.querySelector(".position-diagram__screen--active .position-diagram__island") && !document.querySelector(".preset-name-input"), "Appearance > Position and size draws the screens and sizes; the look and the saved themes are in their own tabs");
    const layoutReset = () => [...document.querySelectorAll<HTMLButtonElement>(".appearance-reset")].find((button) => button.textContent === "恢复默认外观");
    const stored = () => JSON.parse(localStorage.getItem("fuyu-settings") ?? "{}") as { opacity?: number; showTitle?: boolean };
    const before = stored(); await act(async () => { layoutReset()!.click(); }); await click(".appearance-reset--danger");
    check(stored().opacity === before.opacity && stored().showTitle === DEFAULT_SETTINGS.showTitle, "Appearance has its own reset, for sizes and display only");
    await openPage("theme"); await click(".appearance-reset");
    check(storedSettings().opacity === 60, "The first reset click only asks for confirmation");
    await click(".appearance-reset__confirm .appearance-reset:not(.appearance-reset--danger)");
    check(storedSettings().opacity === 60 && document.querySelector(".appearance-reset"), "Cancelling keeps the appearance");
    await click(".appearance-reset"); await click(".appearance-reset--danger");
    check(storedSettings().opacity === DEFAULT_SETTINGS.opacity && storedSettings().carryOverIncompleteTodos === false, "Confirming resets the appearance and keeps todo settings");
    await openPage("themeStyle"); await checkIdleDimSettings(check); await checkGlassLooks(check); await checkNotchPreview(check);
    await openPage("agentAlerts"); await checkAgentNoticeSettings(check);
    await openPage("appearanceCollapsed");
    const zoneRows = (name: string) => [...(document.querySelector(`.collapsed-items__zone[aria-label="${name}"]`)?.querySelectorAll(".plugin-pages__name") ?? [])].map((row) => row.textContent);
    const itemButton = (label: string) => document.querySelector<HTMLButtonElement>(`.collapsed-items button[aria-label="${label}"]`);
    const savedItems = () => JSON.parse(localStorage.getItem("fuyu-collapsed-items") ?? "null") as { items: { id: string; zone: string; hidden?: boolean; shelf?: boolean }[] } | null;
    check(zoneRows("左侧").join("|") === "Agent 状态灯" && zoneRows("右侧")[0] === "新邮件提醒"
      && zoneRows("右侧").slice(-2).join("|") === "会话数 / 会话环|计时器" && savedItems() === null, "The collapsed bar items list the default layout, the timer included, without saving anything");
    await act(async () => { itemButton("移到左侧：会话数 / 会话环")!.click(); });
    await act(async () => { itemButton("上移：会话数 / 会话环")!.click(); });
    check(zoneRows("左侧").join("|") === "会话数 / 会话环|Agent 状态灯" && savedItems()?.items[0].id === "session-count", "An item moves to the other side and up, and the order is saved");
    await act(async () => { document.querySelector<HTMLElement>(".collapsed-items__zone[aria-label='左侧'] li:nth-child(2) .toggle-control, .collapsed-items__zone[aria-label='左侧'] li:nth-child(2) [role='switch']")?.click(); });
    check(savedItems()?.items.find((item) => item.id === "status-light")?.hidden === true, "The status light can be hidden");
    await act(async () => { [...document.querySelectorAll<HTMLButtonElement>(".collapsed-items__reset")][0].click(); });
    check(savedItems() === null && zoneRows("左侧").join("|") === "Agent 状态灯", "Reset to default clears the saved order");
    const badge = (kind: string) => document.querySelector(`.collapsed-items small[data-badge="${kind}"]`)?.textContent;
    await act(async () => { itemButton("收进「+N」小面板：会话数 / 会话环")!.click(); });
    check(savedItems()?.items.find((item) => item.id === "session-count")?.shelf === true && badge("panel") === "在小面板里" && itemButton("放回岛上：会话数 / 会话环")?.getAttribute("aria-pressed") === "true", "An item can be kept behind +N, and its row says it is in the panel");
    await act(async () => { itemButton("放回岛上：会话数 / 会话环")!.click(); });
    localStorage.setItem("fuyu-collapsed-overflow", JSON.stringify(["session-count"]));
    await act(async () => { window.dispatchEvent(new StorageEvent("storage", { key: "fuyu-collapsed-overflow" })); });
    check(!savedItems()?.items.find((item) => item.id === "session-count")?.shelf && badge("panel") === undefined && badge("no-room") === "刘海旁放不下", "Taken back out it is on the island again; a row the island could not fit is marked");
    localStorage.removeItem("fuyu-collapsed-overflow");
    await act(async () => { window.dispatchEvent(new StorageEvent("storage", { key: "fuyu-collapsed-overflow" })); });
    await act(async () => { [...document.querySelectorAll<HTMLButtonElement>(".collapsed-items__reset")][0].click(); });
    check(badge("no-room") === undefined && savedItems() === null, "The mark goes away when the island has room again");
    await act(async () => { await (await import("@tauri-apps/api/event")).emit("plugin-bar-usage-report", { id: 1, collapsed: false, barWidth: null, items: [{ id: "weather", owner: "@fuyu/weather", hideable: true, box: null, name: "天气" }, { id: "ring", owner: "@fuyu/todo-ring", hideable: false, box: null, name: "待办环" }] }); await new Promise((resolve) => setTimeout(resolve, 50)); });
    await act(async () => { itemButton("移到左侧：天气")?.click(); });
    check(zoneRows("左侧").join("|") === "Agent 状态灯|天气" && !zoneRows("右侧").includes("待办环") && savedItems()?.items.find((item) => item.id === "weather")?.zone === "left", "A plugin item the island reports is listed by name and can change sides; one that cannot be hidden is left out"); localStorage.removeItem("fuyu-collapsed-items");

    await openPage("theme");
    await checkThemeMarket(check, () => openPage("overview"));

    await openPage("music");
    const waveSwitch = () => settingRow("在收起的岛上显示音乐波形")?.querySelector<HTMLInputElement>("input");
    check(waveSwitch()?.checked === true && savedItems() === null, "The music wave shows on the collapsed bar by default");
    await act(async () => { waveSwitch()!.click(); });
    check(waveSwitch()?.checked === false && savedItems()?.items.find((item) => item.id === "music")?.hidden === true, "Turning the music wave off hides the bar's music item");
    await act(async () => { waveSwitch()!.click(); }); check(waveSwitch()?.checked === true && !savedItems()?.items.find((item) => item.id === "music")?.hidden, "Turning it on shows it again"); localStorage.removeItem("fuyu-collapsed-items");

    await openPage("behaviorTuck");
    const holdRow = (title: string) => settingRow(title)?.querySelector<HTMLInputElement>("input");
    check(!holdRow("有正在进行的待办时不收起"), "Idle tuck holds are hidden while idle tuck is off");
    await act(async () => { holdRow("闲置时贴边隐藏")!.click(); });
    check(holdRow("有正在进行的待办时不收起")?.checked === true && holdRow("Agent 在等你时不收起")?.checked === true && holdRow("音乐播放中不收起")?.checked === false && holdRow("有未读消息时不收起")?.checked === true,
      "Idle tuck holds: todo, agent and unread messages on, music off by default");
    check(holdRow("有正在进行的待办时不收起")?.closest<HTMLDetailsElement>("details.settings-advanced")?.open === false && settingRow("鼠标移到隐藏的岛上")?.checkVisibility(),
      "The tuck holds sit in a closed Advanced fold while the main tuck choices stay in view");
    const tuckedHover = settingRow("鼠标移到隐藏的岛上");
    const tuckedHoverButton = (label: string) => [...(tuckedHover?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find((button) => button.textContent === label);
    check(tuckedHoverButton("只露出岛屿")?.getAttribute("aria-pressed") === "true", "Hovering a tucked island only slides it out by default");
    await act(async () => { tuckedHoverButton("展开面板")?.click(); });
    check((JSON.parse(localStorage.getItem("fuyu-settings") ?? "{}") as { tuckedHoverAction?: string }).tuckedHoverAction === "expand"
      && tuckedHoverButton("展开面板")?.getAttribute("aria-pressed") === "true",
      "Choosing to open the panel from a tucked island is saved");
    check(tuckedHover && tuckedHover.scrollWidth <= tuckedHover.clientWidth, "The tucked-hover choice fits its row");
    await act(async () => { holdRow("有未读消息时不收起")!.click(); holdRow("音乐播放中不收起")!.click(); }); await openPage("music");
    check(holdRow("音乐播放中不收起")?.checked === true && storedSettings().autoTuckHoldMusic === true && storedSettings().autoTuckHoldMessages === false, "The music page shows the same stay-out-while-playing switch as Behavior");

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

    await checkMessageSources(check, openPage);
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
    await act(async () => { [...document.querySelectorAll<HTMLButtonElement>(".settings-link-button")].find((link) => link.textContent === "添加邮箱")!.click(); }); await type(formEmail(), "new@example.edu.cn");
    await type(element<HTMLInputElement>(".mail-settings__form input[type='password']"), "code");
    check(!document.querySelector(".mail-settings__form input[type='text']"), "The server field stays out of the way until it is asked for");
    await act(async () => { [...document.querySelectorAll<HTMLButtonElement>(".mail-settings__form button")].find((button) => button.textContent === "自己填服务器")!.click(); });
    await type(element<HTMLInputElement>(".mail-settings__form input[type='text']"), "imap.example.edu.cn");
    await act(async () => { element<HTMLButtonElement>(".mail-settings__form button[type='submit']").click(); });
    check(mailCalls.some((call) => call.command === "connect_qq_mail" && call.args.host === "imap.example.edu.cn") && rows().length === 2,
      "Adding a mailbox sends the typed server and lists it");
    const saved = JSON.parse(localStorage.getItem("fuyu-qq-mail-settings") ?? "{}") as { accounts?: { email: string; host: string }[] };
    check(saved.accounts?.some((account) => account.email === "new@example.edu.cn" && account.host === "imap.example.edu.cn"),
      "The typed server is saved with the mailbox");
    await checkMessageNotice(check, openPage);

    await openPage("agentConnect");
    check(texts(".settings-tabs__tab") === "钩子与代理|连接与扩展|审批" && texts(".settings-page__title") === "Agent"
      && element(".settings-sidebar__item--active").dataset.category === "agents",
      "Agent is the first item in the AI Agent group, with tabs for hooks and agents, connection and approvals");
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
    const connectGroups = [...document.querySelectorAll<HTMLElement>(".settings-group")];
    const markerGroup = connectGroups.find((group) => group.textContent?.includes("回复状态标记"));
    check(markerGroup && connectGroups.indexOf(markerGroup) === 0 && markerGroup.textContent!.includes("推荐打开") && !connectGroups.some((group) => group.textContent?.includes("安装/修复")), "The connection page opens with the reply status marker, marked as recommended, and no longer has the hooks card");
    const markerSwitch = markerGroup?.querySelector<HTMLInputElement>("[role='switch']");
    check(markerSwitch && !markerSwitch.checked && markerGroup!.textContent!.includes(REPLY_MARKER.path) && markerGroup!.querySelector("pre")?.textContent === REPLY_MARKER.content && markerGroup!.textContent!.includes(`软链，写在 ${REPLY_MARKER.target}`) && markerGroup!.querySelector(".agent-reply-marker__file--error")?.textContent?.includes(REPLY_MARKER.dangling),
      "The reply status marker is off by default and shows each agent's prompt file (a link names its target, a dangling one its error) and the text it would write");
    await act(async () => { markerSwitch!.click(); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
    check(replyMarkerCalls.join() === "true" && markerSwitch!.checked, "Switching the reply status marker on writes it");

    await openPage("agentRemote"); await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
    check(/devbox.*nas/s.test(element(".editor-panel").textContent ?? "") && texts(".settings-group__title").includes("SSH 代理隧道"), "The SSH remote page lists both the remote hosts and the SSH proxy tunnel section");
    await openPage("agents"); await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
    check(agentPolls() > pollsAway, "The on-the-island page reads the agents' state");
    const agentGroups = [...document.querySelectorAll<HTMLElement>(".editor-panel .settings-group")], hooksGroup = agentGroups.find((group) => group.textContent?.includes("AI Agent 状态灯"));
    const hooksLink = [...(hooksGroup?.querySelectorAll<HTMLButtonElement>(".settings-link-button") ?? [])].find((button) => button.textContent === "安装/修复");
    check(hooksLink && agentGroups.indexOf(hooksGroup!) <= 1 && hooksGroup!.querySelector(".agent-hooks-message--attention"), "The on-the-island page opens with the status light card, which says the hooks are missing and has Install/repair");
    await act(async () => { hooksLink!.click(); await new Promise(resolve => setTimeout(resolve, 20)); });
    check(commands.includes("install_agent_status_hooks") && element(".settings-tabs__tab--active").dataset.tab === "agents", "Install/repair on the on-the-island page installs the hooks there");
    const primaryCards = [...document.querySelectorAll<HTMLElement>(".agent-provider-grid:not(.agent-provider-grid--more) .agent-provider-card")], moreToggle = element<HTMLButtonElement>(".agent-providers__more-toggle");
    check(primaryCards.map((card) => card.dataset.provider).join("|") === "codex|claudeCode" && moreToggle.getAttribute("aria-expanded") === "false", "Detected agents are shown in the primary grid while undetected ones start folded");
    await act(async () => { moreToggle.click(); }); check(moreToggle.getAttribute("aria-expanded") === "true" && document.querySelectorAll(".agent-provider-grid--more .agent-provider-card").length > 0, "Expanding more agents reveals the rest of the supported agents");
    localStorage.removeItem("fuyu-agent-session-filters");
    await openPage("agentSessions");
    const filterGroup = () => [...document.querySelectorAll<HTMLElement>(".settings-group")].find((group) => group.textContent?.includes("隐藏会话"))!;
    const filterInput = filterGroup().querySelector<HTMLInputElement>(".session-filter__form input")!;
    await type(filterInput, "E:\\Projects\\scratch");
    await act(async () => { filterGroup().querySelector<HTMLFormElement>(".session-filter__form")!.requestSubmit(); });
    const savedFilters = JSON.parse(localStorage.getItem("fuyu-agent-session-filters") ?? "[]") as { kind: string; value: string }[];
    check(savedFilters.length === 1 && savedFilters[0].kind === "folder" && savedFilters[0].value === "E:\\Projects\\scratch" && filterInput.value === ""
      && filterGroup().querySelector(".session-filter__value")?.textContent === "E:\\Projects\\scratch", "Adding a hide-sessions rule saves and lists it");
    await act(async () => { filterGroup().querySelector<HTMLButtonElement>(".session-filter__remove")!.click(); });
    check(localStorage.getItem("fuyu-agent-session-filters") === "[]" && !filterGroup().querySelector(".session-filter__value"), "Removing the rule clears it");

    localStorage.removeItem("fuyu-about-tab");
    await click(".settings-sidebar__item[data-category='about']");
    const aboutTab = () => document.querySelector(".settings-tabs__tab--active")?.getAttribute("data-tab");
    check(texts(".settings-tabs__tab") === "概览|更新日志|帮助和交流群" && aboutTab() === "about", "About starts on the overview, with the changelog, the plugin system and help as tabs beside it");
    const hero = element(".about-hero");
    check(hero.querySelector(".about-hero__name")?.textContent === "浮屿" && hero.getBoundingClientRect().height >= hero.scrollHeight - 1, "The overview shows the app's card, not clipped");
    check(document.querySelectorAll(".about-hero__links .about-hero__link").length === 4 && !document.querySelector(".about-logo-pill") && texts(".settings-group__title").includes("重置与退出") && !document.querySelector(".version-history__row"),
      "The overview card holds the four links, the title has no logo pill, reset and quit stay on the overview, and the changelog has its own tab");
    await click(".settings-tabs__tab[data-tab='aboutChangelog']");
    check(document.querySelector(".version-history__row") && document.querySelectorAll(".version-history__item--open").length === 1 && localStorage.getItem("fuyu-about-tab") === "changelog", "The changelog tab lists the releases with one open, and is remembered");
    await openPage("general");
    await click(".settings-sidebar__item[data-category='about']");
    check(aboutTab() === "aboutChangelog", "Coming back to About from the sidebar reopens the last tab");
    localStorage.setItem("fuyu-settings-focus", JSON.stringify({ section: "updates", requestedAt: Date.now(), tab: "help" }));
    await act(async () => { window.dispatchEvent(new StorageEvent("storage", { key: "fuyu-settings-focus", newValue: "{}" })); });
    check(aboutTab() === "aboutHelp" && texts(".settings-group__title").includes("帮助") && localStorage.getItem("fuyu-about-tab") === "help", "A jump to updates with a tab opens that tab and remembers it");
    localStorage.setItem("fuyu-settings-focus", JSON.stringify({ section: "updates", requestedAt: Date.now() }));
    await act(async () => { window.dispatchEvent(new StorageEvent("storage", { key: "fuyu-settings-focus", newValue: "{}" })); });
    check(aboutTab() === "about", "A jump to updates without a tab lands on the overview");
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
