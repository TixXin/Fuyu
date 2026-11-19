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
    await until(() => commands.some(({ command }) => command === "show_onboarding_window"));
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
    check(document.querySelectorAll(".onboarding__dot").length === 8, "The progress shows eight acts, the agent acts and push included while AI Agent is on");
    await press("English");
    check(title() === "Hi, this is Fuyu", "Picking English switches the guide at once");
    await press("简体中文");

    await press("下一步");
    check(title() === "把它捏成你喜欢的样子", "Act 2 shapes the island");
    check(!button("圆角") && !document.querySelector("input[type='range']") && document.querySelectorAll(".onboarding__body .settings-row").length === 3,
      "Act 2 only asks for dark or light, solid or liquid glass, and the accent; corners and motion are left to Settings");
    check(stored().appearanceMode !== "liquidGlass" && !document.body.textContent?.includes("透出桌面壁纸"), "The island starts solid and the glass note stays hidden");
    await press("液态玻璃");
    check(stored().appearanceMode === "liquidGlass" && document.body.textContent?.includes("「设置 → 外观 → 样式」") && document.body.textContent?.includes("纯色玻璃"),
      "Picking liquid glass saves it for the real island and says where to tune it and when it stays solid");
    await press("纯色");
    check(stored().appearanceMode === "classic", "Going back to solid saves it for the real island");
    await press("浅色");
    check(stored().themeMode === "light" && document.querySelector(".onboarding--light"), "Picking light saves it for the real island and turns the card light");

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
    check(pluginOn("music") === true && pluginOn("agents") === false && pluginOn("todos") === false && pluginOn("clipboard") === false && clipboard.enabled === false,
      "Answering Leisure keeps music and the shelf and takes the rest off");
    check(document.querySelectorAll(".onboarding__dot").length === 5, "Without AI Agent there is no push act");
    check(removed() === "已卸下：待办、AI Agent、翻译、邮箱、剪贴板。点贴纸就能装回，以后在设置里也行。", "The card says what the answer took off");
    await act(async () => { persona(4).click(); });
    await wait(20);
    check(pluginOn("todos") === true && pluginOn("agents") === true && pluginOn("screenshot") === false && pluginOn("clipboard") === true && clipboard.enabled === true && !removed(),
      "Taking the answer back restores the modules that were on before it");
    await act(async () => { persona(4).click(); });
    await wait(20);
    await press("剪贴板");
    await press("AI Agent");
    check(clipboard.enabled === true && pluginOn("clipboard") === true && pluginOn("agents") === true, "Clicking a sticker puts that module on");
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
    await until(() => commands.some(({ command }) => command === "get_file_shelf"));
    shelfItems = [{ id: "dropped", addedAt: 2 }];
    await until(() => stars() === 2);
    check(stars() === 2, "A file landing on the shelf earns a star, even when the shelf holds as many entries as before");
    await act(async () => { await emit("clipboard-popup-opened"); });
    await until(() => stars() === 3);
    check(stars() === 3 && document.querySelector(".onboarding__lead")?.textContent === "全部完成，你已经会用了。", "The real clipboard popup opening earns the last star");
    await act(async () => { document.querySelector<HTMLInputElement>("#onboarding-winv")!.click(); });
    await until(() => clipboard.winV === true);
    check(clipboard.winV === true, "Win+V is saved in the clipboard settings");
    await placeIsland(closed);

    await press("下一步");
    const choice = (label: string) => document.querySelector<HTMLButtonElement>(`.onboarding__body button[aria-label='${label}']`)?.textContent;
    check(title() === "AI 代理的会话卡片", "With AI Agent on, the session cards act comes after the practice");
    check(choice("显示方式") === "卡片（推荐）" && choice("归档动画") === "粒子消散（推荐）" && choice("卡片光效") === "粒子流苏（推荐）",
      "The session cards start on the recommended choices, marked as such");
    await act(async () => { document.querySelector<HTMLButtonElement>(".onboarding__body button[aria-label='显示方式']")!.click(); });
    await act(async () => { document.querySelector<HTMLElement>(".select-control__option[data-value='list']")!.click(); });
    await wait(10);
    check(stored().agentSessionView === "list" && !choice("卡片光效") && choice("归档动画"),
      "Card glow only shows for the card and compact layouts; the archive motion stays for every layout");

    await press("下一步");
    check(title() === "连上你的 AI 代理" && [...document.querySelectorAll(".onboarding__step")].map((step) => step.textContent?.slice(0, 2)).join("") === "1.2.3.",
      "The connect act walks through SSH remotes, agents with Install/repair, then the reply marker");
    check(document.querySelector(".agent-remote__intro") && document.body.textContent?.includes("让 AI 代理在回复末尾标出在等什么"), "The act reuses the settings for remotes and the reply marker");

    await press("下一步");
    check(title() === "推送到手机" && document.querySelector(".push-act__step--active")?.textContent === "安装", "AI Agent being on adds the push act before the last one");
    for (let step = 0; step < 4; step += 1) await press("下一步");
    check(title() === "推送到手机" && document.querySelector(".push-act__step--active")?.textContent === "测试", "Next walks through the five push steps first");
    await press("上一步");
    check(document.querySelector(".push-act__step--active")?.textContent === "接机器人", "Back goes back one push step");
    await press("下一步");
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

    const offer = (value: string | null) => act(async () => {
      if (value === null) localStorage.removeItem("fuyu-onboarding-bundle");
      else localStorage.setItem("fuyu-onboarding-bundle", value);
      window.dispatchEvent(new StorageEvent("storage", { key: "fuyu-onboarding-bundle" }));
    });
    const loc = (zh: string, en: string) => ({ "zh-CN": zh, en });
    const bundle = { id: "pomodoro-flow", displayName: loc("番茄工作法", "Pomodoro flow"), description: loc("番茄钟、待办进度环和每日小结", "A timer, a to-do ring and a daily digest"), members: [{ name: "@fuyu/pomodoro", displayName: loc("番茄钟", "Pomodoro") }, { name: "@fuyu/todo-ring", displayName: loc("待办进度环", "To-do ring") }] };
    const dots = () => document.querySelectorAll(".onboarding__dot").length;
    const withoutBundle = dots();
    await act(async () => { root.unmount(); });
    await offer(JSON.stringify(bundle));
    const again = createRoot(document.getElementById("root")!);
    await act(async () => { again.render(<StrictMode><I18nProvider><OnboardingWindow /></I18nProvider></StrictMode>); });
    await placeIsland(closed);
    check(dots() === withoutBundle + 1, "When the island has a bundle to recommend, the guide has one more act");
    for (let step = 0; step < 20 && title() !== "装一组搭配好的插件"; step += 1) await press("下一步");
    const offered = document.querySelector<HTMLElement>("[data-onboarding-bundle='pomodoro-flow']");
    check(offered?.textContent?.includes("番茄工作法") && [...offered.querySelectorAll(".onboarding-bundle__member")].map((item) => item.textContent).join() === "番茄钟,待办进度环", "The bundle act names the bundle and the plugins in it");
    check(button("下一步") && button("跳过") && offered!.scrollWidth <= offered!.clientWidth, "It is not the last act, and it fits the card");
    await press("下一步");
    check(title() === "准备好了", "The act that finishes the guide comes right after it");
    await press("上一步");
    localStorage.removeItem("fuyu-settings-focus");
    localStorage.removeItem("fuyu-onboarding-welcome");
    const opens = () => commands.filter(({ command }) => command === "open_settings_window").length;
    const before = { opens: opens(), closes: closes() };
    await press("看看这个套装");
    const focus = JSON.parse(localStorage.getItem("fuyu-settings-focus") ?? "{}") as { section?: string; bundle?: string };
    check(focus.section === "pluginMarket" && focus.bundle === "pomodoro-flow" && opens() === before.opens + 1, "Its button opens Settings on the plugin market, asking for this bundle");
    check(closes() === before.closes + 1 && welcome().kind === "ready" && !commands.some(({ command }) => /install/i.test(command)), "It ends the guide like the other links to Settings, and the guide installs nothing itself");
    await offer(null);
    check(dots() === withoutBundle && title() === "准备好了", "When the recommendation goes away, so does the act");
    await offer("{broken");
    check(dots() === withoutBundle, "A record that cannot be read adds no act");
    await offer(null);
    await act(async () => { again.unmount(); });

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
