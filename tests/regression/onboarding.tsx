// pnpm dev, then open /tests/regression/onboarding.html (860 × 680 is the window's size).
// Without ?test=1 the page is for visual QA: ?act=<1-5> opens that act, ?locale=en switches
// the language, ?light=1 shows the light theme. ?test=1 runs the checks below.
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
if (query.has("light")) localStorage.setItem("fuyu-settings", JSON.stringify({ themeMode: "light" }));

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
const island = () => document.querySelector<HTMLElement>(".mini-island")!;
const islandIcons = () => island().querySelectorAll(".mini-island__icon").length;
const stored = () => JSON.parse(localStorage.getItem("fuyu-settings") ?? "{}") as Record<string, unknown>;
const fitsWindow = () => {
  const body = document.querySelector<HTMLElement>(".onboarding__body")!;
  return body.scrollWidth <= body.clientWidth;
};
const dropSticker = async (module: string) => {
  const data = new DataTransfer();
  data.setData("application/x-fuyu-module", module);
  await act(async () => {
    island().dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: data }));
    island().dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: data }));
  });
  await wait(10);
};

if (!automated) {
  mount();
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
    check(commands.some(({ command }) => command === "show_onboarding_window"), "The window is shown once the page has painted");
    check(title() === "一座岛刚刚落在你的屏幕上" && !button("上一步") && button("跳过"), "Act 1 lands the island, with Skip and no Back");
    check(document.querySelectorAll(".onboarding__dot").length === 5, "The progress shows five acts");
    const firstHello = island().querySelector(".mini-island__label")?.textContent;
    await wait(1_450);
    check(island().querySelector(".mini-island__label")?.textContent !== firstHello, "The island says hello in turn");
    await press("English");
    check(title() === "An island just landed on your screen", "Picking English switches the guide at once");
    await press("简体中文");
    await act(async () => { island().click(); });
    await wait(10);
    check(title() === "把它捏成你喜欢的样子", "Clicking the island begins");

    await press("浅色");
    check(stored().themeMode === "light" && document.querySelector(".onboarding--light"), "Picking light saves it and turns the window light");
    const radius = () => island().style.getPropertyValue("--mini-radius");
    const before = radius();
    const slider = document.querySelector<HTMLInputElement>("input[type='range']")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(slider, "40");
      slider.dispatchEvent(new Event("input", { bubbles: true }));
    });
    check(stored().islandCornerRadius === 40 && radius() !== before, "The corners change on the small island as they are saved");

    await press("下一步");
    check(title() === "给岛装上功能" && fitsWindow(), "Act 3 fits the window's width");
    await act(async () => { document.querySelector<HTMLButtonElement>(".outfit-act__persona:nth-child(4)")!.click(); });
    await wait(20);
    check(stored().musicEnabled === true && stored().agentStatusEnabled === false && stored().todoEnabled === false && clipboard.enabled === false,
      "Answering Leisure puts on music and the shelf and takes the rest off");
    check(islandIcons() === 2, "The island's bar shows an icon per module");
    await press("剪贴板");
    check(clipboard.enabled === true, "Clicking a sticker puts that module on");
    await dropSticker("agents");
    check(stored().agentStatusEnabled === true && islandIcons() === 4, "Dropping a sticker on the island puts it on too");

    await press("下一步");
    check(title() === "试着用一下" && document.querySelectorAll(".play-act__task").length === 3, "Act 4 has three tasks while the shelf and clipboard are on");
    await press("点击");
    check(stored().expandTrigger === "click", "The island can be set to open on click");
    await act(async () => { island().click(); });
    check(island().classList.contains("mini-island--expanded") && document.querySelectorAll(".play-act__task--done").length === 1, "Opening the island earns a star");
    await press("放进去");
    check(island().textContent?.includes("旅行计划.pdf") && document.querySelectorAll(".play-act__task--done").length === 2, "Putting the file on the island shows it on the shelf");
    await act(async () => { await emit("clipboard-popup-opened"); });
    await wait(10);
    check(document.querySelectorAll(".play-act__task--done").length === 3 && document.querySelector(".onboarding__lead")?.textContent === "全部完成，你已经会用了。",
      "The real clipboard popup opening earns the last star");
    await act(async () => { document.querySelector<HTMLInputElement>("#onboarding-winv")!.click(); });
    await wait(10);
    check(clipboard.winV === true, "Win+V is saved in the clipboard settings");

    await press("下一步");
    check(title() === "准备好了" && button("开始使用") && !button("跳过"), "The last act finishes instead of skipping");
    await press("连接 AI 编程工具");
    check(localStorage.getItem("fuyu-settings-focus")?.includes("agentConnect"), "Connect opens Settings on the Agent connect page");
    localStorage.removeItem("fuyu-settings-focus");
    await press("开始使用");
    const flight = commands.find(({ command }) => command === "fly_onboarding_to_island");
    check(flight?.args.durationMs === 620 && document.querySelector(".onboarding--flying"), "Get started flies the window into the island");
    await wait(600);
    check(localStorage.getItem("fuyu-onboarding-welcome")?.includes("requestedAt"), "The island is asked to greet the user as the window lands");

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
