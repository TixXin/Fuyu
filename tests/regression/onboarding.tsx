import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { emit } from "@tauri-apps/api/event";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import "../../src/styles/fonts.css";
import "../../src/styles/base.css";
import { OnboardingWindow } from "../../src/windows/onboarding/OnboardingWindow";
import { I18nProvider, LOCALE_STORAGE_KEY } from "../../src/i18n";

const query = new URLSearchParams(location.search);
const automated = query.has("test");
Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: automated });

const commands: { command: string; args: Record<string, unknown> }[] = [];
let clipboard: Record<string, unknown> = { enabled: true, winV: false, shortcut: "Ctrl+Shift+W", shortcutEnabled: true };
let launchAtStartup = false;
let shelfItems: { id: string; addedAt: number }[] = [{ id: "earlier", addedAt: 1 }];
mockIPC((command, payload) => {
  const args = (payload ?? {}) as Record<string, unknown>;
  commands.push({ command, args });
  switch (command) {
    case "get_clipboard_history": return { settings: clipboard, items: [] };
    case "set_clipboard_history_settings":
      clipboard = { ...clipboard, ...(args.settings as object) };
      return { settings: clipboard, items: [] };
    case "get_launch_at_startup": return launchAtStartup;
    case "set_launch_at_startup": launchAtStartup = Boolean(args.enabled); return null;
    case "get_file_shelf": return { items: shelfItems };
    default: return null;
  }
}, { shouldMockEvents: true });
mockWindows("onboarding");

const original = new Map(Object.entries(localStorage).filter(([key]) => key.startsWith("fuyu-")));
const restore = () => {
  for (const key of Object.keys(localStorage).filter((key) => key.startsWith("fuyu-"))) {
    if (!original.has(key)) localStorage.removeItem(key);
  }
  for (const [key, value] of original) localStorage.setItem(key, value);
};
window.addEventListener("beforeunload", restore);

localStorage.setItem(LOCALE_STORAGE_KEY, query.get("locale") === "en" ? "en" : "zh-CN");
localStorage.removeItem("fuyu-settings");
localStorage.removeItem("fuyu-onboarding-welcome");
localStorage.removeItem("fuyu-onboarding-demo");
if (query.has("light")) localStorage.setItem("fuyu-settings", JSON.stringify({ themeMode: "light" }));
document.body.style.background = "linear-gradient(135deg, #3a3f55, #6a5a7a 50%, #2b4a6a)";

const closed = { x: innerWidth / 2 - 130, y: 0, width: 260, height: 38, expanded: false };
const open = { x: innerWidth / 2 - 280, y: 0, width: 560, height: 380, expanded: true };
const placeIsland = (spot: typeof closed | null) => act(async () => { await emit("onboarding-island", spot); });

const root = createRoot(document.getElementById("root")!);
const mount = () => root.render(<StrictMode><I18nProvider><OnboardingWindow /></I18nProvider></StrictMode>);
const messages: string[] = [];
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
  messages.push(`PASS ${message}`);
};
const wait = (ms: number) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });
const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>("button")].find((found) => found.textContent?.trim() === label);
const press = async (label: string) => {
  const target = button(label);
  if (!target) throw new Error(`Missing button ${label}`);
  await act(async () => { target.click(); });
  await wait(10);
};
const title = () => document.querySelector(".onboarding__title")?.textContent;
const card = () => document.querySelector<HTMLElement>(".onboarding__card")!;
const stored = () => JSON.parse(localStorage.getItem("fuyu-settings") ?? "{}") as Record<string, unknown>;
const stars = () => document.querySelectorAll(".play-act__task--done").length;
const welcome = () => JSON.parse(localStorage.getItem("fuyu-onboarding-welcome") ?? "{}") as { kind?: string };

if (!automated) {
  mount();
  setTimeout(() => void emit("onboarding-island", query.has("open") ? open : closed), 300);
  const target = Number(query.get("act") ?? 1);
  const advance = (left: number) => {
    if (left <= 0) return;
    const next = button("下一步") ?? button("Next");
    if (!next) {
      setTimeout(() => advance(left), 20);
      return;
    }
    next.click();
    setTimeout(() => advance(left - 1), 20);
  };
  advance(target - 1);
} else {
  try {
    await act(async () => { mount(); });
    await wait(30);
    check(commands.some(({ command }) => command === "show_onboarding_window"), "The overlay is shown once the page has painted");
    check(welcome().kind === "hello", "The island is asked to say hello as the guide opens");
    check(JSON.parse(localStorage.getItem("fuyu-onboarding-demo") ?? "{}").until > Date.now(), "The island's demo runs while the guide is open");
    check(document.querySelector(".onboarding-spotlight--none") && document.querySelector(".onboarding__notice"), "Without an island the screen dims and the card says how to bring it back");

    await placeIsland(closed);
    const spotlight = document.querySelector<HTMLElement>(".onboarding-spotlight")!;
    check(!document.querySelector(".onboarding__notice") && parseFloat(spotlight.style.width) === closed.width + 16, "The spotlight lights up the real island");
    check(parseFloat(card().style.top) === closed.height + 28, "The card sits below the island");
    check(commands.some(({ command, args }) => command === "set_onboarding_card_rects" && Array.isArray(args.rects) && args.rects.length === 1),
      "The card's rectangle goes to the native side, so only the card takes the pointer");
    check(title() === "你好，这就是浮屿" && !button("上一步") && button("跳过"), "Act 1 says hello, with Skip and no Back");
    check(document.querySelectorAll(".onboarding__dot").length === 5, "The progress shows five acts");
    await press("English");
    check(title() === "Hi, this is Fuyu", "Picking English switches the guide at once");
    await press("简体中文");

    await press("下一步");
    check(title() === "把它捏成你喜欢的样子", "Act 2 shapes the island");
    await press("圆角");
    check(stored().islandCornerShape === "round", "The corner shape can be picked");
    await press("浅色");
    check(stored().themeMode === "light" && document.querySelector(".onboarding--light"), "Picking light saves it for the real island and turns the card light");
    const slider = document.querySelector<HTMLInputElement>("input[type='range']")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(slider, "40");
      slider.dispatchEvent(new Event("input", { bubbles: true }));
    });
    check(stored().islandCornerRadius === 40, "The corners are saved as they change");

    await press("下一步");
    const body = document.querySelector<HTMLElement>(".onboarding__body")!;
    check(title() === "留下你用得上的功能" && body.scrollWidth <= body.clientWidth, "Act 3 fits the card's width");
    const persona = (at: number) => document.querySelector<HTMLButtonElement>(`.outfit-act__persona:nth-child(${at})`)!;
    const removed = () => document.querySelector(".outfit-act__removed")?.textContent ?? "";
    check(persona(1).textContent === "写代码AI Agent、剪贴板、截图、待办、文件中转" && persona(4).textContent === "娱乐音乐、文件中转",
      "Each answer lists every module it puts on");
    check(!removed(), "Nothing is listed as taken off before an answer");
    await act(async () => { persona(4).click(); });
    await wait(20);
    check(stored().musicEnabled === true && stored().agentStatusEnabled === false && stored().todoEnabled === false && clipboard.enabled === false,
      "Answering Leisure keeps music and the shelf and takes the rest off");
    check(removed() === "已卸下：待办、AI Agent、翻译、邮箱、剪贴板。点贴纸就能装回，以后在设置里也行。", "The card says what the answer took off");
    await act(async () => { persona(4).click(); });
    await wait(20);
    check(stored().todoEnabled === true && stored().agentStatusEnabled === true && stored().screenshotEnabled === false && clipboard.enabled === true && !removed(),
      "Taking the answer back restores the modules that were on before it");
    await act(async () => { persona(4).click(); });
    await wait(20);
    await press("剪贴板");
    await press("AI Agent");
    check(clipboard.enabled === true && stored().agentStatusEnabled === true, "Clicking a sticker puts that module on");
    check(removed().startsWith("已卸下：待办、翻译、邮箱。"), "A sticker put back leaves the taken-off list");
    await press("下一步");
    await press("上一步");
    check(persona(4).getAttribute("aria-pressed") === "true" && removed().startsWith("已卸下：待办、翻译、邮箱。"), "The answer is still there after leaving the act and coming back");

    await placeIsland(open);
    await press("下一步");
    check(title() === "在真岛上试一下" && document.querySelectorAll(".play-act__task").length === 3, "Act 4 has three tasks while the shelf and clipboard are on");
    check(document.querySelector(".onboarding__lead")?.textContent === "岛上正放着一首演示歌曲，还有一个演示 Agent 在干活。完成下面的小任务。", "The practice names the demo song and agent while both modules are on");
    check(stars() === 0, "An island that was already open when the practice began earns nothing");
    await placeIsland(closed);
    await press("点击");
    check(stored().expandTrigger === "click", "The island can be set to open on click");
    await placeIsland(open);
    check(stars() === 1 && document.querySelector(".onboarding-spotlight--open"), "Opening the real island earns a star, and the light grows with it");
    check(parseFloat(card().style.top || "0") !== closed.height + 28, "The card moves out of the way of the open island");
    await wait(900);
    shelfItems = [{ id: "dropped", addedAt: 2 }];
    await wait(900);
    check(stars() === 2, "A file landing on the shelf earns a star, even when the shelf holds as many entries as before");
    await act(async () => { await emit("clipboard-popup-opened"); });
    await wait(10);
    check(stars() === 3 && document.querySelector(".onboarding__lead")?.textContent === "全部完成，你已经会用了。", "The real clipboard popup opening earns the last star");
    await act(async () => { document.querySelector<HTMLInputElement>("#onboarding-winv")!.click(); });
    await wait(10);
    check(clipboard.winV === true, "Win+V is saved in the clipboard settings");
    await placeIsland(closed);

    await press("下一步");
    check(title() === "准备好了" && button("开始使用") && !button("跳过"), "The last act finishes instead of skipping");
    check(parseFloat(card().style.top) === closed.height + 28, "Back below the island after the practice");
    check(document.body.textContent?.includes("右键托盘里的浮屿图标"), "The last act says where Settings is found later");
    const closes = () => commands.filter(({ command }) => command.includes("close")).length;
    await press("连接 AI 编程工具");
    check(localStorage.getItem("fuyu-settings-focus")?.includes("agentConnect"), "Connect opens Settings on the Agent connect page");
    const order = commands.map(({ command }) => command);
    check(closes() === 1 && order.indexOf("open_settings_window") !== -1 && order.indexOf("open_settings_window") < order.findIndex((command) => command.includes("close")),
      "Connect opens Settings first and then closes the overlay, so Settings is not left under the dimming");
    check(welcome().kind === "ready" && localStorage.getItem("fuyu-onboarding-demo") === null, "Leaving for Settings ends the guide like Get started does");
    localStorage.removeItem("fuyu-settings-focus");
    localStorage.removeItem("fuyu-onboarding-welcome");
    await press("开始使用");
    check(welcome().kind === "ready" && localStorage.getItem("fuyu-onboarding-demo") === null, "Get started asks the island to say it is ready and ends the demo");
    check(closes() === 2, "Get started closes the overlay");

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
