import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { emit } from "@tauri-apps/api/event";
import { mockIPC } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import "../../src/styles/fonts.css";
import { I18nProvider, LOCALE_STORAGE_KEY } from "../../src/i18n";
import { TrayMenuCard } from "../../src/windows/tray-menu/TrayMenuCard";
import { TrayMenuWindow } from "../../src/windows/tray-menu/TrayMenuWindow";
import { TRAY_MENU_LAYOUTS, TRAY_MENU_LAYOUT_KEY } from "../../src/windows/tray-menu/storage";
import type { TrayMenuState } from "../../src/windows/tray-menu/api";
import type { TrayCardData, TrayCardHandlers } from "../../src/windows/tray-menu/types";
import { STORAGE_KEY, loadSettings } from "../../src/lib/settings/storage";
import { trayCardFixtures } from "./trayMenuFixtures";

const params = new URLSearchParams(location.search);
const automated = params.has("test");
const english = document.documentElement.dataset.lang === "en";
Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: automated });
const storedBefore = Object.entries(localStorage);
function restoreStorage() {
  localStorage.clear();
  for (const [name, value] of storedBefore) localStorage.setItem(name, value);
}
window.addEventListener("pagehide", restoreStorage);
localStorage.clear();
localStorage.setItem(LOCALE_STORAGE_KEY, english ? "en" : "zh-CN");
const realMatchMedia = window.matchMedia.bind(window);
window.matchMedia = (query: string) => (query.includes("prefers-color-scheme: dark") ? { ...realMatchMedia(query), matches: true, addEventListener: () => {}, removeEventListener: () => {} } : realMatchMedia(query));

const fx = trayCardFixtures();
Date.now = () => fx.now;
let windowState: TrayMenuState = fx.state;
const calls: string[] = [];
mockIPC((command, args) => {
  calls.push(`${command}:${JSON.stringify(args ?? {})}`);
  switch (command) {
    case "tray_menu_state": return windowState;
    case "get_launch_at_startup": return true;
    case "get_clipboard_history": return { settings: { shortcut: "Ctrl+Shift+W", shortcutEnabled: true }, items: [] };
    case "get_media_state": return fx.mediaState;
    case "media_play_pause": return { ...fx.mediaState, playbackStatus: "paused" };
    case "get_calendar_events": return { events: fx.events, problems: [], fetchedAt: fx.now, fromMs: 0, toMs: 0, sourceCount: 1 };
    case "list_agent_sessions": return fx.sessions;
    case "get_builtin_plugins": return builtinList(new Set());
    default: return null;
  }
}, { shouldMockEvents: true });

function builtinList(off: ReadonlySet<string>) {
  return ["todos", "calendar", "music", "clipboard", "screenshot", "file-shelf", "translation", "agents"].map((id) => ({ id, kind: "builtin", enabled: !off.has(id), background: [], config: {} }));
}

const noop: TrayCardHandlers = { onAction: () => {}, onDnd: () => {}, onAutostart: () => {}, onPlayPause: () => {}, onNext: () => {}, onJoin: () => {} };
const galleryData: TrayCardData = { state: fx.state, shortcuts: fx.shortcuts, off: new Set(), dnd: false, autostart: true, media: fx.media, meeting: fx.meeting, agents: fx.agents, now: fx.now };

function Gallery() {
  return (
    <>
      {(["dark", "light"] as const).map((tone) =>
        TRAY_MENU_LAYOUTS.map((layout) => (
          <div key={`${tone}-${layout}`} className={tone === "light" ? "cell light island-light" : "cell"} data-cell={`${layout}-${tone}`}>
            <h3>{`${layout} · ${tone}`}</h3>
            <TrayMenuCard layout={layout} light={tone === "light"} data={galleryData} handlers={noop} />
          </div>
        )),
      )}
    </>
  );
}

const gallery = createRoot(document.getElementById("gallery")!);
const win = createRoot(document.getElementById("window")!);
const render = () => {
  gallery.render(<StrictMode><I18nProvider><Gallery /></I18nProvider></StrictMode>);
  win.render(<StrictMode><I18nProvider><TrayMenuWindow /></I18nProvider></StrictMode>);
};
if (automated) await act(async () => render());
else render();

const messages: string[] = [];
function check(condition: unknown, label: string) {
  if (!condition) throw new Error(label);
  messages.push(`PASS ${label}`);
}
const $ = <T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => root.querySelector<T>(selector);
const $$ = <T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => [...root.querySelectorAll<T>(selector)];
const settle = () => act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 30));
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
});
const card = () => $("#window .tray-card")!;
const key = (target: Element, name: string) => act(async () => {
  target.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true }));
});
const setLayout = (layout: string) => act(async () => {
  localStorage.setItem(TRAY_MENU_LAYOUT_KEY, layout);
  window.dispatchEvent(new StorageEvent("storage", { key: TRAY_MENU_LAYOUT_KEY }));
});
const openCard = () => act(async () => { await emit("tray-menu-open"); });
const actions = () => calls.filter((call) => call.startsWith("tray_menu_action"));

function overflowing(root: HTMLElement) {
  const edge = root.getBoundingClientRect().right + 0.5;
  return $$("button, .tray-card__label, .tray-card__switch-label", root).filter((el) => el.getBoundingClientRect().right > edge || (el.matches(".tray-card__tile .tray-card__label") && el.scrollWidth > el.clientWidth + 1));
}

async function runChecks() {
  try {
    await settle();
    for (const cell of $$("[data-cell]")) {
      const c = $(".tray-card", cell)!;
      check(overflowing(c).length === 0, `${cell.dataset.cell}：${english ? "英文" : "中文"}没有溢出卡片的按钮和文字`);
    }
    check($$(".tray-card--light").length === 3 && $$("[data-cell$='-dark'] .tray-card--light").length === 0, "三版各有深色和浅色");

    await openCard();
    await settle();
    check(card()?.dataset.layout === "entry", "没设过时默认 A 入口型");
    const resize = calls.filter((call) => call.startsWith("tray_menu_resize")).slice(-1)[0];
    check(resize && /"width":3\d\d/.test(resize) && /"height":[1-9]\d\d/.test(resize), "量出卡片大小后调 tray_menu_resize");
    check(document.activeElement === $$("button", card())[0], "打开时焦点在第一个按钮");

    const first = $$("button", card())[0];
    await key(first, "ArrowRight");
    check(document.activeElement === $$("button", card())[1], "→ 移到下一个按钮");
    await key(document.activeElement!, "ArrowDown");
    check(card().contains(document.activeElement) && document.activeElement !== $$("button", card())[1], "↓ 移到下一行");

    const switches = $$("[role=switch]", card());
    check(switches.length === 3 && switches.every((sw) => sw.hasAttribute("aria-checked")), "A 的三个开关是 role=switch，带 aria-checked");
    const dndBefore = loadSettings().gameDoNotDisturb;
    check(switches[0].getAttribute("aria-checked") === String(dndBefore), "游戏勿扰开关读岛的设置");
    await act(async () => switches[0].click());
    check(loadSettings().gameDoNotDisturb === !dndBefore && switches[0].getAttribute("aria-checked") === String(!dndBefore), "游戏勿扰开关写进岛的设置");
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));

    const before = actions().length;
    await act(async () => switches[1].click());
    check(actions().slice(before).join() === 'tray_menu_action:{"action":"toggle_clipboard_pause","arg":null}', "暂停剪贴板记录走 tray_menu_action，不额外发 close");

    const translate = $$("button", card()).find((button) => button.getAttribute("aria-label")?.startsWith(english ? "Translate" : "翻译"))!;
    check(translate.getAttribute("aria-disabled") === "true", "翻译关掉时格子标成不可用");
    await act(async () => translate.click());
    check(actions().slice(-1)[0]?.includes("open_settings"), "点关掉的功能去设置里开");

    const agentPage = $$("button", card()).find((button) => button.getAttribute("aria-label")?.includes(english ? "Agents" : "AI 代理"))!;
    await act(async () => agentPage.click());
    check(actions().slice(-1)[0] === 'tray_menu_action:{"action":"open_page","arg":"agent"}', "打开 Agent 页带上页面参数");

    await key($$("button", card())[0], "Escape");
    check(actions().slice(-1)[0]?.includes('"close"'), "Esc 调 tray_menu_action(\"close\")");

    await setLayout("status");
    await openCard();
    await settle();
    check(card().dataset.layout === "status", "改了样式后再打开换成 B 状态型（监听 storage）");
    check($(".tray-card__cover img", card()) && $(".tray-card__mini", card()) && $(".tray-card__dot--waiting", card()), "B 版显示正在放的歌、可加入的会议和等你的 Agent");
    await act(async () => $<HTMLButtonElement>(`[aria-label="${english ? "Pause" : "暂停"}"]`, card())!.click());
    check(calls.some((call) => call.startsWith("media_play_pause")) && $(`[aria-label="${english ? "Play" : "播放"}"]`, card()), "播放 / 暂停用媒体的命令，按钮跟着变");

    await setLayout("compact");
    windowState = { ...fx.state, platform: "macos", updateAvailable: null };
    await openCard();
    await settle();
    check(card().dataset.layout === "compact" && $$("[role=switch]", card()).length === 1, "C 精简型只有一个开关");
    check(!$(".tray-card__badge", card()), "没有新版本时不显示「可更新」");

    await setLayout("nonsense");
    await settle();
    check(card().dataset.layout === "entry", "不认识的值按 A 入口型");
    check($$("kbd", card()).some((kbd) => kbd.textContent?.includes("⌘") || kbd.textContent?.includes("⌃")), "Mac 上快捷键写成符号");

    windowState = fx.state;
    await setLayout("entry");
    await openCard();
    await settle();

    const tiles = () => $$(".tray-card__entry-main > button", card()).length;
    const strip = () => $$(".tray-card__strip .tray-card__icon-button", card()).length;
    check(tiles() === 4 && strip() === 5 && $$("[role=switch]", card()).length === 3 && $$(".tray-card__knob", card()).every((knob) => getComputedStyle(knob).transitionProperty === "transform"), "功能都开着时入口齐全");
    await act(async () => { await emit("builtin-plugins-changed", builtinList(new Set(["file-shelf", "translation", "clipboard", "music"]))); });
    await settle();
    check(tiles() === 2 && strip() === 4 && $$("[role=switch]", card()).length === 2, "关掉一个功能后入口消失：A 版藏掉文件中转、翻译、剪贴板和暂停记录");
    await setLayout("status");
    await settle();
    check($$(".tray-card__pills > button", card()).length === 2 && !$(".tray-card__cover", card()), "关掉一个功能后入口消失：B 版藏掉翻译和音乐");
    await setLayout("compact");
    await settle();
    check($$(".tray-card__compact-row > button", card()).length === 2 && $$("[role=switch]", card()).length === 0, "关掉一个功能后入口消失：C 版藏掉翻译、剪贴板和暂停记录");
    await act(async () => { await emit("builtin-plugins-changed", builtinList(new Set())); });
    await setLayout("entry");
    await settle();
    check(tiles() === 4 && strip() === 5, "重新打开功能后入口回来");

    restoreStorage();
    results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
    results.dataset.result = "passed";
  } catch (error) {
    restoreStorage();
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
  }
}

const results = document.getElementById("results")!;
if (automated) void runChecks();
else results.textContent = "演示：三版托盘卡片和一个接了 mock 的卡片窗口。加 ?test=1 运行检查；英文看 tray-menu-en.html。";
