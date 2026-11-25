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
import { setOnboardingLaunchMode } from "../../src/windows/onboarding/storage";
import { I18nProvider, LOCALE_STORAGE_KEY } from "../../src/i18n";
import { until } from "./pollUntil";

const query = new URLSearchParams(location.search);
const automated = query.has("test");
Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: automated });

const SAMPLE_QR = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const originalFetch = window.fetch.bind(window);
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.includes("community.json")) {
    return new Response(
      JSON.stringify({
        version: 1,
        updatedAt: "2026-11-25",
        groups: [
          {
            id: "wechat-users",
            platform: "wechat",
            name: { "zh-CN": "浮屿用户交流群", en: "Fuyu users" },
            qr: "wechat-group.png",
            expiresAt: "2099-12-31",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
  return originalFetch(input, init);
}) as typeof window.fetch;

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
    case "plugin:app|version": return "0.3.14-beta.1";
    case "get_island_edge": return "top";
    case "get_island_taskbar": return { docked: false, placed: false, light: false };
    case "get_taskbar_layout": return [{ edge: "bottom" }];
    case "set_island_edge": return null;
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
const emittedTo: { label: string; event: string; payload: unknown }[] = [];
type Invoke = (command: string, args?: unknown, options?: unknown) => Promise<unknown>;
const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: Invoke } }).__TAURI_INTERNALS__;
const mockedInvoke = internals.invoke;
internals.invoke = (command, args, options) => {
  const sent = (args ?? {}) as { target?: { label?: string }; event?: unknown; payload?: unknown };
  if (command === "plugin:event|emit_to") emittedTo.push({ label: sent.target?.label ?? "", event: String(sent.event), payload: sent.payload });
  return mockedInvoke(command, args, options);
};

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
localStorage.removeItem("fuyu-onboarding-director");
localStorage.removeItem("fuyu-onboarding-mode");
localStorage.removeItem("fuyu-onboarding-guide-version");
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
const director = () => JSON.parse(localStorage.getItem("fuyu-onboarding-director") ?? "{}") as { action?: string; page?: string };

if (!automated) {
  if (query.get("mode") === "whatsNew") setOnboardingLaunchMode("whatsNew", "0.3.13");
  mount();
  setTimeout(() => void emit("onboarding-island", query.has("open") ? open : closed), 300);
  const target = Number(query.get("act") ?? 1);
  const advance = (left: number) => {
    if (left <= 0) return;
    const next = button("开始定制浮屿") ?? button("Customize Fuyu") ?? button("下一步") ?? button("Next");
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
    check(parseFloat(card().style.top) >= closed.height + 24, "The wide stage card sits comfortably below the island");
    check(title() === "你好，这就是浮屿" && !button("上一步") && button("稍后再说") && button("开始定制浮屿"), "Act 1 greets with a clear start button and non-ambiguous exit");
    check(Boolean(document.querySelector(".hello-act__emblem")) && Boolean(document.querySelector(".director-hud")), "Act 1 shows the Fuyu emblem and top-right auto-demo director HUD");
    check(document.querySelectorAll(".onboarding__dot").length === 5, "The main tour stays concise at 5 steps even while AI Agent is on");

    await until(() => Boolean(document.querySelector(".wechat-corner")));
    const cornerImg = document.querySelector<HTMLImageElement>(".wechat-corner__qr img");
    if (cornerImg) cornerImg.src = SAMPLE_QR;
    await act(async () => { document.querySelector<HTMLElement>(".wechat-corner")!.click(); });
    await wait(10);
    check(Boolean(document.querySelector(".wechat-lightbox")), "Clicking anywhere on the bottom-left WeChat card opens the centered large QR lightbox");
    await act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
    await wait(10);
    check(!document.querySelector(".wechat-lightbox"), "Pressing Esc closes the QR lightbox first without closing onboarding");

    check(document.querySelectorAll("[data-director-group]").length === 3, "Act 1 exposes all three live demo groups (forms & docking, agent notices, panels)");
    await act(async () => { document.querySelector<HTMLButtonElement>('[data-director-scene="formPill"]')!.click(); });
    await wait(10);
    check(stored().islandForm === "pill", "Clicking Floating Pill in the director strip transforms the real island form");

    await act(async () => { document.querySelector<HTMLButtonElement>('[data-director-scene="dockRight"]')!.click(); });
    await wait(10);
    check(commands.some(({ command, args }) => command === "set_island_edge" && args.edge === "right"), "Clicking Dock Right drives real side-edge adsorption");

    await act(async () => { document.querySelector<HTMLButtonElement>('[data-director-scene="agentApproval"]')!.click(); });
    await until(() => emittedTo.some((sent) => sent.label === "main" && sent.event === "agent-test-notice"));
    const noticeEmit = emittedTo.find((sent) => sent.label === "main" && sent.event === "agent-test-notice");
    check((noticeEmit?.payload as { event?: string } | undefined)?.event === "approval", "Clicking an Agent notice scene triggers a real Agent test notice on the island");

    await act(async () => { document.querySelector<HTMLButtonElement>('[data-director-scene="agents"]')!.click(); });
    await until(() => director().action === "expand" && director().page === "agents");
    check(director().action === "expand" && director().page === "agents", "Clicking a panel scene clears notices and opens that page on the real island");

    await press("English");
    check(title() === "Hi, this is Fuyu" && button("Customize Fuyu"), "Picking English switches the guide at once");
    await press("简体中文");

    await press("开始定制浮屿");
    check(stored().islandForm === "top", "Advancing out of Act 1 automatically restores the user's original island form");
    check(title() === "选一种形态，捏成喜欢的样子" && Boolean(document.querySelector(".onboarding-spotlight--calm")), "Act 2 shapes island form, theme, jellyfish and motion with a calm spotlight");
    check(document.querySelectorAll("[data-island-form]").length === 7, "Act 2 exposes all 7 island forms including taskbar when available");
    await act(async () => { document.querySelector<HTMLButtonElement>('[data-island-form="pill"]')!.click(); });
    await wait(10);
    check(stored().islandForm === "pill", "Picking Floating Pill saves islandForm=pill to real settings");
    await act(async () => { document.querySelector<HTMLButtonElement>('[data-island-form="notch"]')!.click(); });
    await wait(10);
    check(stored().islandForm === "notch", "Picking Notch saves islandForm=notch to real settings");
    await act(async () => { document.querySelector<HTMLButtonElement>('[data-motion="pop"]')!.click(); });
    await wait(10);
    check(stored().islandMotion === "pop" && director().action === "expand", "Picking a motion saves it and triggers a live island motion showcase");
    await press("像素");
    check(stored().jellyfishStyle === "fine", "Switching jellyfish style updates real settings");
    await press("液态玻璃");
    check(stored().appearanceMode === "liquidGlass", "Picking liquid glass saves it for the real island");
    await press("纯色");
    check(stored().appearanceMode === "classic", "Going back to solid saves it for the real island");
    await press("浅色");
    check(stored().themeMode === "light" && document.querySelector(".onboarding--light"), "Picking light saves it and turns the card light");

    await act(async () => { document.querySelectorAll<HTMLButtonElement>(".onboarding__dot")[0].click(); });
    await wait(10);
    check(title() === "你好，这就是浮屿", "Clicking a completed progress chip jumps back to that step");
    await press("开始定制浮屿");
    await press("下一步");

    const body = document.querySelector<HTMLElement>(".onboarding__body")!;
    check(title() === "核心能力全景，按需装配" && body.scrollWidth <= body.clientWidth, "Act 3 fits the card's width");
    check(document.querySelector(".outfit-act__count")?.textContent === "已开启 10 / 11", "Act 3 displays all 11 built-in modules and how many are enabled");
    const persona = (at: number) => document.querySelector<HTMLButtonElement>(`.outfit-act__persona:nth-child(${at})`)!;
    await act(async () => { persona(4).click(); });
    await wait(20);
    check(pluginOn("music") === true && pluginOn("agents") === false && clipboard.enabled === false, "Answering Leisure updates real built-in plugin switches");
    await act(async () => { persona(4).click(); });
    await wait(20);
    check(pluginOn("agents") === true && clipboard.enabled === true, "Undoing the preset restores the previous modules");
    await press("在真岛打开这一页");
    check(director().action === "expand" && director().page === "agents", "Live capability preview opens the corresponding page on the real island");

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
    check(title() === "浮屿已就绪" && Boolean(document.querySelector(".release-act__summary")), "The summary act renders the configured form/motion/modules summary");
    check(Boolean(document.querySelector('[data-extension="agentSetup"]')), "Summary hub exposes the optional AI Agent setup extension when AI Agent is enabled");

    await act(async () => { document.querySelector<HTMLButtonElement>('[data-extension="agentSetup"]')!.click(); });
    await wait(20);
    check(document.querySelector("main")?.getAttribute("data-mode") === "setup" && Boolean(document.querySelector(".onboarding-spotlight--off")), "Opening AI Agent setup switches to the wide unobstructed workspace mode");
    check(title() === "选一种 Agent 会话布局" && document.querySelectorAll("[data-session-view]").length === 5, "Agent layout step shows visual cards for all 5 layouts");
    await act(async () => { document.querySelector<HTMLButtonElement>('[data-session-view="minimal"]')!.click(); });
    await wait(10);
    check(stored().agentSessionView === "minimal" && !document.querySelector("button[aria-label='卡片光效']"), "Picking minimal layout saves it and hides card effects");

    await press("下一步");
    check(title() === "连上你的 AI 代理", "Agent connect step keeps SSH remotes, hooks and reply marker");
    await press("下一步");
    check(title() === "推送到手机", "Push step follows inside the setup workspace");
    await press("跳过此步");
    check(title() === "浮屿已就绪" && Boolean(document.querySelector(".release-act__done-badge")), "Returning from agent setup marks it as configured");

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
    check(Boolean(offered) && [...offered!.querySelectorAll(".release-act__member")].map((item) => item.textContent).join() === "番茄钟,待办进度环", "Recommended bundle renders inside the summary hub without inflating main step count");

    const closes = () => commands.filter(({ command }) => command.includes("close")).length;
    const opens = () => commands.filter(({ command }) => command === "open_settings_window").length;
    const before = { opens: opens(), closes: closes() };
    await act(async () => { document.querySelector<HTMLButtonElement>('[data-action="onboarding-bundle-open"]')!.click(); });
    await wait(20);
    const focus = JSON.parse(localStorage.getItem("fuyu-settings-focus") ?? "{}") as { section?: string; bundle?: string };
    check(focus.section === "pluginMarket" && focus.bundle === "pomodoro-flow" && opens() === before.opens + 1, "Bundle CTA opens Settings on the plugin market with that bundle selected");
    check(closes() === before.closes + 1, "Bundle CTA finishes onboarding");

    await offer(null);
    await act(async () => { root.unmount(); });
    setOnboardingLaunchMode("whatsNew", "0.3.13");
    const whatsNewRoot = createRoot(document.getElementById("root")!);
    await act(async () => { whatsNewRoot.render(<StrictMode><I18nProvider><OnboardingWindow /></I18nProvider></StrictMode>); });
    await placeIsland(closed);
    await until(() => Boolean(document.querySelector(".whats-new-act__pill")));
    check(document.querySelector("main")?.getAttribute("data-mode") === "whatsNew", "What's New mode launches independently for upgraded users");
    check(Boolean(document.querySelector(".whats-new-act__pill")?.textContent?.includes("0.3.14")), "What's New displays the current version badge and release notes");
    check(Boolean(document.querySelector(".wechat-corner")), "Bottom-left WeChat community card is also available in What's New mode");
    const whatsNewImg = document.querySelector<HTMLImageElement>(".wechat-corner__qr img");
    if (whatsNewImg) whatsNewImg.src = SAMPLE_QR;
    await press("下一步");
    check(title() === "在真岛上试试多种形态" && document.querySelectorAll("[data-island-form]").length === 7, "Second What's New act lets upgraded users try live island forms");

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
