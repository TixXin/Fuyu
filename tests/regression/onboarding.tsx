// pnpm dev, then open /tests/regression/onboarding.html (720 × 560 is the window's size).
// Without ?test=1 the page is for visual QA: ?step=<1-4> opens that step, ?locale=en switches
// the language, ?light=1 shows the light theme. ?test=1 runs the checks below.
import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
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
let clipboard: Record<string, unknown> = { enabled: true, winV: false };
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
});
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
if (query.has("light")) localStorage.setItem("fuyu-settings", JSON.stringify({ themeMode: "light" }));

const root = createRoot(document.getElementById("root")!);
const mount = () => root.render(<StrictMode><I18nProvider><OnboardingWindow /></I18nProvider></StrictMode>);
const messages: string[] = [];
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
  messages.push(`PASS ${message}`);
};
const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>("button")].find((found) => found.textContent?.trim() === label);
const press = async (label: string) => {
  const target = button(label);
  if (!target) throw new Error(`Missing button ${label}`);
  await act(async () => { target.click(); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
};
const title = () => document.querySelector(".onboarding__title")?.textContent;
const row = (text: string) => [...document.querySelectorAll<HTMLElement>(".settings-row")].find((found) => found.textContent?.includes(text));
const toggle = async (text: string) => {
  const input = row(text)?.querySelector<HTMLInputElement>("input[type='checkbox'], button[role='switch']");
  if (!input) throw new Error(`Missing switch ${text}`);
  await act(async () => { input.click(); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
};
const stored = () => JSON.parse(localStorage.getItem("fuyu-settings") ?? "{}") as Record<string, unknown>;
const fitsWindow = () => {
  const body = document.querySelector<HTMLElement>(".onboarding__body")!;
  return body.scrollWidth <= body.clientWidth;
};

if (!automated) {
  mount();
  const step = Number(query.get("step") ?? 1);
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
  advance(step - 1);
} else {
  try {
    await act(async () => { mount(); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
    check(commands.some(({ command }) => command === "show_onboarding_window"), "The window is shown once the page has painted");
    check(title() === "欢迎使用浮屿" && !button("上一步") && button("跳过引导"), "Step 1 welcomes, with Skip and no Back");
    check(document.querySelectorAll(".onboarding__dot").length === 4, "The progress shows four steps");

    await press("浅色");
    check(stored().themeMode === "light" && document.querySelector(".onboarding--light"), "Picking light saves it and turns the window light");
    await press("English");
    check(title() === "Welcome to Fuyu" && localStorage.getItem(LOCALE_STORAGE_KEY) === "en", "Picking English switches the guide at once");
    await press("简体中文");

    await press("下一步");
    check(title() === "想用哪些功能" && button("上一步"), "Step 2 lists the modules");
    check(fitsWindow(), "Step 2 fits the window's width");
    await toggle("音乐控制");
    check(stored().musicEnabled === false, "Turning a module off saves it in the island's settings");
    await toggle("截图");
    check(stored().screenshotEnabled === true, "Screenshots, off by default, can be turned on");

    await press("下一步");
    check(title() === "怎么用顺手" && row("用 Win+V"), "Step 3 offers Win+V while clipboard history is on");
    await press("点击");
    check(stored().expandTrigger === "click", "The island can be set to open on click");
    await toggle("开机时启动");
    check(launchAtStartup, "Start with Windows is written to the registry");
    await toggle("用 Win+V");
    check(clipboard.winV === true, "Win+V is saved in the clipboard settings");

    await press("上一步");
    await toggle("剪贴板历史");
    check(clipboard.enabled === false, "Clipboard history can be turned off");
    await press("下一步");
    check(!row("用 Win+V"), "Without clipboard history, Win+V is not offered");

    await press("下一步");
    check(title() === "准备好了" && button("开始使用") && !button("跳过引导"), "The last step finishes instead of skipping");
    await press("连接 AI 编程工具");
    check(commands.some(({ command }) => command === "open_settings_window")
      && localStorage.getItem("fuyu-settings-focus")?.includes("agentConnect"), "Connect opens Settings on the Agent connect page");
    localStorage.removeItem("fuyu-settings-focus");

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
