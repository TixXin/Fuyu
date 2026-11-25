import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { emit } from "@tauri-apps/api/event";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import "../../src/styles/fonts.css";
import "../../src/styles/base.css";
import catalog from "../../src/features/builtins.json";
import { BUILTIN_PLUGINS_CHANGED, type BuiltinPlugin } from "../../src/features/plugin-kernel/api";
import { OnboardingWindow } from "../../src/windows/onboarding/OnboardingWindow";
import { I18nProvider, LOCALE_STORAGE_KEY } from "../../src/i18n";
import { until } from "./pollUntil";

const query = new URLSearchParams(location.search);
const automated = query.has("test");
Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: automated });

const commands: { command: string; args: Record<string, unknown> }[] = [];
let clipboard: Record<string, unknown> = { enabled: true, winV: false, shortcut: "Ctrl+Shift+W", shortcutEnabled: true };
let launchAtStartup = false;
let marker = false;
let shelfItems: { id: string; addedAt: number }[] = [{ id: "earlier", addedAt: 1 }];
let builtins: BuiltinPlugin[] = catalog.plugins.map(({ id, kind }) => ({
  id,
  kind: kind === "essential" ? "essential" : "builtin",
  enabled: id !== "screenshot",
  background: [],
  config: id === "messages" ? { qq: true, wechat: true, mail: true } : {},
}));
const pluginOn = (id: string) => builtins.find((plugin) => plugin.id === id)?.enabled;
mockIPC((command, payload) => {
  const args = (payload ?? {}) as Record<string, unknown>;
  commands.push({ command, args });
  switch (command) {
    case "get_builtin_plugins": return builtins.map((plugin) => ({ ...plugin, config: { ...plugin.config } }));
    case "set_builtin_plugin_enabled":
      builtins = builtins.map((plugin) => (plugin.id === String(args.id) ? { ...plugin, enabled: Boolean(args.enabled) } : plugin));
      void emit(BUILTIN_PLUGINS_CHANGED, builtins.map((plugin) => ({ ...plugin, config: { ...plugin.config } })));
      return builtins.map((plugin) => ({ ...plugin, config: { ...plugin.config } }));
    case "set_builtin_plugin_config":
      builtins = builtins.map((plugin) => (plugin.id === String(args.id) ? { ...plugin, config: { ...plugin.config, [String(args.key)]: args.value } } : plugin));
      void emit(BUILTIN_PLUGINS_CHANGED, builtins.map((plugin) => ({ ...plugin, config: { ...plugin.config } })));
      return builtins.map((plugin) => ({ ...plugin, config: { ...plugin.config } }));
    case "get_clipboard_history": return { settings: clipboard, items: [] };
    case "set_clipboard_history_settings":
      clipboard = { ...clipboard, ...(args.settings as object) };
      return { settings: clipboard, items: [] };
    case "get_launch_at_startup": return launchAtStartup;
    case "set_launch_at_startup": launchAtStartup = Boolean(args.enabled); return null;
    case "get_file_shelf": return { items: shelfItems };
    case "get_agent_status": return { codex: { phase: "idle", updatedAt: 0 }, claudeCode: { phase: "idle", updatedAt: 0 }, updatedAt: 0, statusPath: "" };
    case "get_agent_remote_hosts": case "list_ssh_hosts": case "get_agent_custom_hosts": return [];
    case "get_reply_marker_state":
    case "set_reply_marker":
      if (command === "set_reply_marker") marker = Boolean(args.enabled);
      return { installed: marker, outdated: false, files: [], oldRules: [], content: "", remotes: [] };
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
localStorage.removeItem("fuyu-onboarding-bundle");
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
    const next = button("开始认识") ?? button("Let's start") ?? button("下一步") ?? button("Next");
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
    await until(() => commands.some(({ command }) => command === "show_onboarding_window"));
    check(commands.some(({ command }) => command === "show_onboarding_window"), "The overlay is shown once the page has painted");
    check(welcome().kind === "hello", "The island is asked to say hello as the guide opens");
    check(JSON.parse(localStorage.getItem("fuyu-onboarding-demo") ?? "{}").until > Date.now(), "The island's demo runs while the guide is open");
    check(document.querySelector(".onboarding-spotlight--none") && document.querySelector(".onboarding__notice"), "Without an island the screen dims and the card says how to bring it back");

    await placeIsland(closed);
    const spotlight = document.querySelector<HTMLElement>(".onboarding-spotlight")!;
    check(!document.querySelector(".onboarding__notice") && parseFloat(spotlight.style.width) === closed.width + 16, "The spotlight lights up the real island");
    check(parseFloat(card().style.top) >= closed.height + 28, "The card sits comfortably below the island");
    check(commands.some(({ command, args }) => command === "set_onboarding_card_rects" && Array.isArray(args.rects) && args.rects.length === 1),
      "The card's rectangle goes to the native side, so only the card takes the pointer");
    check(title() === "你好，这就是浮屿" && !button("上一步") && button("稍后再说") && button("开始认识"), "Act 1 greets with a clear start button and non-ambiguous exit");
    check(Boolean(document.querySelector(".hello-act__emblem")) && document.querySelectorAll(".hello-act__pill").length === 3, "Act 1 renders the Fuyu emblem and 3-step roadmap preview");
    check(document.querySelectorAll(".onboarding__dot").length === 5, "The main tour stays concise at 5 steps even while AI Agent is on");
    await press("English");
    check(title() === "Hi, this is Fuyu" && button("Let's start"), "Picking English switches the guide at once");
    await press("简体中文");

    await press("开始认识");
    check(title() === "把它捏成你喜欢的样子" && Boolean(document.querySelector(".onboarding-spotlight--calm")), "Act 2 shapes the island with a calm spotlight");
    check(document.querySelectorAll(".onboarding__body .settings-row").length === 3, "Act 2 asks for dark or light, solid or liquid glass, and the accent");
    await press("液态玻璃");
    check(stored().appearanceMode === "liquidGlass" && document.body.textContent?.includes("「设置 → 外观 → 样式」"), "Picking liquid glass saves it and explains where to tune it");
    await press("纯色");
    check(stored().appearanceMode === "classic", "Going back to solid saves it for the real island");
    await press("浅色");
    check(stored().themeMode === "light" && document.querySelector(".onboarding--light"), "Picking light saves it and turns the card light");

    await act(async () => { document.querySelectorAll<HTMLButtonElement>(".onboarding__dot")[0].click(); });
    await wait(10);
    check(title() === "你好，这就是浮屿", "Clicking a completed progress dot jumps back to that step");
    await press("开始认识");
    await press("下一步");

    const body = document.querySelector<HTMLElement>(".onboarding__body")!;
    check(title() === "留下你用得上的功能" && body.scrollWidth <= body.clientWidth, "Act 3 fits the card's width");
    check(document.querySelector(".outfit-act__count")?.textContent === "已开启 7 / 8", "Act 3 displays how many modules are currently enabled");
    const persona = (at: number) => document.querySelector<HTMLButtonElement>(`.outfit-act__persona:nth-child(${at})`)!;
    const removed = () => document.querySelector(".outfit-act__removed")?.textContent ?? "";
    await act(async () => { persona(4).click(); });
    await wait(20);
    check(pluginOn("music") === true && pluginOn("agents") === false && clipboard.enabled === false, "Answering Leisure keeps music and the shelf and takes the rest off");
    check(document.querySelector(".outfit-act__count")?.textContent === "已开启 2 / 8", "The module counter updates with the preset");
    check(removed() === "已卸下：待办、AI Agent、翻译、邮箱、剪贴板。点贴纸就能装回，以后在设置里也行。", "The card says what the answer took off");
    await act(async () => { persona(4).click(); });
    await wait(20);
    check(pluginOn("agents") === true && clipboard.enabled === true && !removed(), "Taking the answer back restores the previous modules");
    await act(async () => { persona(4).click(); });
    await wait(20);
    await press("剪贴板");
    await press("AI Agent");
    check(clipboard.enabled === true && pluginOn("clipboard") === true && pluginOn("agents") === true, "Clicking stickers toggles modules back on");

    await placeIsland(open);
    await press("下一步");
    check(title() === "在真岛上试一下" && document.querySelectorAll(".play-act__task").length === 3 && button("跳过此步"), "Act 4 has three practice tasks and an explicit Skip step button");
    check(stars() === 0, "An island already open when practice begins earns nothing");
    await placeIsland(closed);
    await press("点击");
    check(stored().expandTrigger === "click", "The island can be set to open on click");
    await placeIsland(open);
    check(stars() === 1 && document.querySelector(".onboarding-spotlight--open"), "Opening the real island earns a star");
    await until(() => commands.some(({ command }) => command === "get_file_shelf"));
    shelfItems = [{ id: "dropped", addedAt: 2 }];
    await until(() => stars() === 2);
    check(stars() === 2, "A file landing on the shelf earns a star");
    await act(async () => { await emit("clipboard-popup-opened"); });
    await until(() => stars() === 3);
    check(stars() === 3 && document.querySelector(".onboarding__lead")?.textContent === "全部完成，你已经上手了。", "Opening the clipboard earns the final star");
    await act(async () => { document.querySelector<HTMLInputElement>("#onboarding-winv")!.click(); });
    await until(() => clipboard.winV === true);
    check(clipboard.winV === true, "Win+V is saved in the clipboard settings");
    await placeIsland(closed);

    await press("下一步");
    check(title() === "浮屿已就绪" && button("开始使用") && !button("稍后再说"), "The summary act finishes instead of showing exit");
    check(Boolean(document.querySelector('[data-extension="agentSetup"]')), "Summary hub exposes the optional AI Agent setup extension when AI Agent is enabled");

    await act(async () => { document.querySelector<HTMLButtonElement>('[data-extension="agentSetup"]')!.click(); });
    await wait(20);
    check(document.querySelector("main")?.getAttribute("data-mode") === "setup", "Opening AI Agent setup switches to the optional setup workspace mode");
    check(Boolean(document.querySelector(".onboarding-spotlight--off")), "Workspace setup drops the dark spotlight overlay");
    check(parseFloat(card().style.width) === Math.min(640, innerWidth - 32), "Workspace setup expands the card to the wide layout");
    check(title() === "选一种 Agent 会话布局" && document.querySelectorAll("[data-session-view]").length === 5, "Agent layout step shows visual cards for all 5 layouts");
    await act(async () => { document.querySelector<HTMLButtonElement>('[data-session-view="minimal"]')!.click(); });
    await wait(10);
    check(stored().agentSessionView === "minimal" && !document.querySelector("button[aria-label='卡片光效']"), "Picking minimal layout saves it and hides card effects");

    await press("下一步");
    check(title() === "连上你的 AI 代理" && [...document.querySelectorAll(".onboarding__step")].map((step) => step.textContent?.slice(0, 2)).join("") === "1.2.3.", "Agent connect step keeps SSH remotes, agent hooks and reply marker");
    await press("下一步");
    check(title() === "推送到手机" && document.querySelector(".push-act__step--active")?.textContent === "安装", "Push step follows inside the wide setup track");
    await press("跳过此步");
    check(title() === "浮屿已就绪" && document.querySelector("main")?.getAttribute("data-mode") === "main", "Skipping the last setup step returns to the summary screen");
    check(Boolean(document.querySelector(".release-act__done-badge")), "Returning from agent setup marks it as configured");

    const offer = (value: string | null) => act(async () => {
      if (value === null) localStorage.removeItem("fuyu-onboarding-bundle");
      else localStorage.setItem("fuyu-onboarding-bundle", value);
      window.dispatchEvent(new StorageEvent("storage", { key: "fuyu-onboarding-bundle" }));
    });
    const loc = (zh: string, en: string) => ({ "zh-CN": zh, en });
    const bundle = { id: "pomodoro-flow", displayName: loc("番茄工作法", "Pomodoro flow"), description: loc("番茄钟、待办进度环和每日小结", "A timer, a to-do ring and a daily digest"), members: [{ name: "@fuyu/pomodoro", displayName: loc("番茄钟", "Pomodoro") }, { name: "@fuyu/todo-ring", displayName: loc("待办进度环", "To-do ring") }] };
    await offer(JSON.stringify(bundle));
    await wait(20);
    const offered = document.querySelector<HTMLElement>("[data-onboarding-bundle='pomodoro-flow']");
    check(Boolean(offered) && [...offered!.querySelectorAll(".release-act__member")].map((item) => item.textContent).join() === "番茄钟,待办进度环", "Recommended bundle appears directly in the summary extension hub without inflating step count");
    check(document.querySelectorAll(".onboarding__dot").length === 5, "A recommended bundle does not add an extra dot to the main flow");

    const closes = () => commands.filter(({ command }) => command.includes("close")).length;
    const opens = () => commands.filter(({ command }) => command === "open_settings_window").length;
    const before = { opens: opens(), closes: closes() };
    await act(async () => { document.querySelector<HTMLButtonElement>('[data-action="onboarding-bundle-open"]')!.click(); });
    await wait(20);
    const focus = JSON.parse(localStorage.getItem("fuyu-settings-focus") ?? "{}") as { section?: string; bundle?: string };
    check(focus.section === "pluginMarket" && focus.bundle === "pomodoro-flow" && opens() === before.opens + 1, "Bundle CTA opens Settings on the plugin market with that bundle selected");
    check(closes() === before.closes + 1 && welcome().kind === "ready" && !commands.some(({ command }) => /install/i.test(command)), "Bundle CTA ends the guide without auto-installing anything");

    localStorage.removeItem("fuyu-onboarding-welcome");
    await press("开始使用");
    check(welcome().kind === "ready" && localStorage.getItem("fuyu-onboarding-demo") === null, "Get started asks the island to say it is ready and ends the demo");
    check(closes() === before.closes + 2, "Get started closes the overlay");

    await offer(null);
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
