import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { emit } from "@tauri-apps/api/event";
import { mockIPC } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import { I18nProvider } from "../../src/i18n";
import { AgentSessionsPanel } from "../../src/features/agent-status/AgentSessionsPanel";
import type { AgentSessionSummary } from "../../src/features/agent-status/api";
import type { SessionRemoval } from "../../src/features/agent-status/useHiddenSessions";
import type { AlertedSession } from "../../src/features/agent-status/useAgentAlerts";
import { SESSION_FILTERS_STORAGE_KEY } from "../../src/features/agent-status/sessionFilters";
import type { AgentSessionView } from "../../src/features/agent-status/agentSettings";
import { until } from "./pollUntil";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });
const calls: Array<{ command: string; payload: Record<string, unknown> }> = [];
mockIPC((command, payload) => {
  calls.push({ command, payload: (payload ?? {}) as Record<string, unknown> });
  if (command === "list_agent_effort_labels") return {};
  if (command === "focus_agent_window") return true;
  return null;
}, { shouldMockEvents: true });
const copied: string[] = [];
Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (value: string) => { copied.push(value); } } });
const original = window.matchMedia.bind(window);
window.matchMedia = (query: string) => (query.includes("prefers-reduced-motion") ? ({ ...original(query), matches: true, media: query }) : original(query));
localStorage.removeItem(SESSION_FILTERS_STORAGE_KEY);

const now = Date.now();
const SESSIONS: AgentSessionSummary[] = [
  {
    provider: "claudeCode", sessionId: "a", cwd: "E:\\Projects\\fuyu", title: "Agent 页会话行的右键菜单、键盘选行和悬停卡片，标题很长时卡片里要写全",
    model: "Opus 5.5", effort: null, phase: "running", updatedAt: now - 20_000, turnStartedAt: now - 200_000,
    lastPrompt: "给 Agent 页的会话行加上右键菜单和键盘操作", lastMessage: "已经加好菜单。", host: { name: "Windows Terminal", exe: null, kind: "terminal" },
  },
  {
    provider: "codex", sessionId: "b", cwd: "E:\\Projects\\MioPicFlow", title: "恢复发布机环境",
    model: null, effort: null, phase: "completed", updatedAt: now - 14 * 60_000, turnStartedAt: null, lastMessage: null, host: null,
  },
  {
    provider: "claudeCode", sessionId: "c", cwd: "/home/tixxin/fuyu", title: "远程主机上的会话", remoteHost: "devbox",
    model: null, effort: null, phase: "completed", updatedAt: now - 95 * 60_000, turnStartedAt: null, lastMessage: null, host: null,
  },
];

const fixture = document.getElementById("fixture")!;
const root = createRoot(fixture);
const results = document.getElementById("results")!;
const messages: string[] = [];
function check(condition: unknown, label: string) {
  if (!condition) throw new Error(label);
  messages.push(`PASS ${label}`);
}
const archived: string[] = [];
let removed: AgentSessionSummary | null = null;
const removal: SessionRemoval = { remove: (session) => { archived.push(session.sessionId); }, removed, undo: () => { removed = null; } };

const render = (view: AgentSessionView, extra: { reveal?: AlertedSession; withRemoval?: boolean } = {}) => act(async () => root.render(
  <StrictMode><I18nProvider>
    <AgentSessionsPanel sort="recent" group="none" view={view} sessions={SESSIONS} hostDisplay="off" removal={extra.withRemoval === false ? undefined : removal} reveal={extra.reveal} />
  </I18nProvider></StrictMode>,
));

const ROW = ".agent-session, .agent-card";
const items = () => [...document.querySelectorAll<HTMLElement>(".agent-sessions__list > li[data-session-key]")];
const rowButtons = () => items().map((item) => item.querySelector<HTMLElement>(ROW)!);
const menu = () => document.querySelector<HTMLElement>(".row-menu");
const menuLabels = () => [...document.querySelectorAll<HTMLButtonElement>(".row-menu [role=menuitem]")].map((item) => item.textContent);
const menuItem = (label: string) => [...document.querySelectorAll<HTMLButtonElement>(".row-menu [role=menuitem]")].find((item) => item.textContent === label)!;
const press = (target: Element, key: string, init: KeyboardEventInit = {}) =>
  act(async () => { target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init })); });
const rightClick = (target: Element) =>
  act(async () => { target.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 })); });
const closeMenu = async () => {
  await act(async () => { document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); });
  await until(() => !menu());
};
const hoverCard = () => document.querySelector<HTMLElement>(".agent-session-hover-card");
const openMenu = async (target: Element) => {
  await rightClick(target);
  await until(menu);
};
const HOVER_DELAY_MS = 600;

async function menuChecks(view: AgentSessionView) {
  await render(view);
  const [first, , remote] = items();
  const more = first.querySelector<HTMLButtonElement>(".agent-session__more button");
  check(more?.getAttribute("aria-haspopup") === "menu" && more.getAttribute("aria-label")?.includes("更多操作"), `${view}：每行有「更多操作」按钮`);
  check(await until(() => getComputedStyle(first.querySelector(".agent-session__more")!).opacity === "0"), `${view}：平时「⋯」不显示`);

  await openMenu(first.querySelector(ROW)!);
  check(menu() && menuLabels().join("|") === "跳到窗口|在文件夹中显示|复制路径|复制会话 id|归档|隐藏这个目录的会话", `${view}：右键一行弹出行菜单，项齐全`);
  check(await until(() => document.activeElement === menuItem("跳到窗口")), `${view}：菜单打开后焦点在第一项`);
  await press(document.activeElement!, "ArrowDown");
  check(document.activeElement === menuItem("在文件夹中显示"), `${view}：菜单里 ↓ 选下一项`);
  await press(document.activeElement!, "ArrowUp");
  await press(document.activeElement!, "ArrowUp");
  check(document.activeElement === menuItem("隐藏这个目录的会话"), `${view}：菜单里 ↑ 从第一项绕到最后一项`);
  await press(document.activeElement!, "Escape");
  check(!menu() && document.activeElement === more, `${view}：Esc 关菜单，焦点回到「⋯」`);

  await openMenu(remote.querySelector(ROW)!);
  check(menu() && !menuLabels().includes("在文件夹中显示") && menuLabels().includes("复制路径"), `${view}：远程会话没有「在文件夹中显示」`);
  await closeMenu();
}

async function runChecks() {
  try {
    await menuChecks("list");

    await openMenu(rowButtons()[0]);
    await act(async () => menuItem("复制会话 id").click());
    check(await until(() => copied[copied.length - 1] === "a" && !menu()), "复制会话 id，菜单关闭");
    check(await until(() => items()[0].querySelector('[role="status"]')?.textContent === "已复制"), "复制后行内提示「已复制」");
    await openMenu(rowButtons()[0]);
    await act(async () => menuItem("复制路径").click());
    check(await until(() => copied[copied.length - 1] === "E:\\Projects\\fuyu"), "复制路径写进剪贴板");
    await openMenu(rowButtons()[0]);
    await act(async () => menuItem("在文件夹中显示").click());
    const reveal = await until(() => calls.find((call) => call.command === "plugin:opener|reveal_item_in_dir"));
    check(reveal && JSON.stringify(reveal.payload).includes("fuyu"), "在文件夹中显示走 opener 的 revealItemInDir");
    let storageEvents = 0;
    const onStorage = (event: StorageEvent) => { if (event.key === SESSION_FILTERS_STORAGE_KEY) storageEvents += 1; };
    window.addEventListener("storage", onStorage);
    await openMenu(rowButtons()[1]);
    await act(async () => menuItem("隐藏这个目录的会话").click());
    window.removeEventListener("storage", onStorage);
    const filters = JSON.parse(localStorage.getItem(SESSION_FILTERS_STORAGE_KEY) ?? "[]");
    check(filters.some((filter: { kind: string; value: string }) => filter.kind === "folder" && filter.value === "E:\\Projects\\MioPicFlow") && storageEvents === 1, "按目录隐藏写进「隐藏会话」规则并通知同窗口的列表");
    await openMenu(rowButtons()[1]);
    await act(async () => menuItem("跳到窗口").click());
    check(await until(() => calls.some((call) => call.command === "focus_agent_window" && call.payload.sessionId === "b")), "菜单里的「跳到窗口」和点一行一样");
    await act(async () => {
      await emit("agent-focus-window-only", { provider: "codex", sessionId: "b", app: "codex", name: "Codex" });
    });
    check(await until(() => items()[1].querySelector('[role="status"]')?.textContent === "已切到窗口，请选会话" && !items()[0].querySelector('[role="status"]')), "只能切到应用窗口时在该行提示手动选会话");
    await act(async () => rowButtons()[1].click());
    check(await until(() => !items()[1].querySelector('[role="status"]')), "再次点击精确聚焦时清除行内提示");
    await openMenu(rowButtons()[1]);
    await act(async () => menuItem("归档").click());
    check(archived[archived.length - 1] === "b", "菜单里的「归档」归档这一行");

    await render("list");
    const rows = rowButtons();
    check(rows.every((row) => row.tagName === "BUTTON"), "每行是按钮，Enter 跳转");
    rows[0].focus();
    await press(rows[0], "ArrowDown");
    check(document.activeElement === rows[1], "↓ 选下一行");
    await press(rows[1], "End");
    check(document.activeElement === rows[2], "End 选最后一行");
    await press(rows[2], "ArrowDown");
    check(document.activeElement === rows[2], "最后一行再 ↓ 停在原处");
    await press(rows[2], "Home");
    check(document.activeElement === rows[0], "Home 回到第一行");
    await press(rows[0], "ArrowUp");
    check(document.activeElement === rows[0], "第一行再 ↑ 停在原处");
    await press(rows[0], "ArrowDown", { altKey: true });
    check(document.activeElement === rows[0], "带修饰键的方向键不处理，留给岛上的快捷键");
    await press(rows[1], "F10", { shiftKey: true });
    check(await until(() => menu() && items()[1].querySelector('.agent-session__more [aria-expanded="true"]')), "Shift+F10 打开选中行的菜单");
    await press(document.activeElement!, "Escape");
    await press(rows[0], "ContextMenu");
    check(await until(() => menu() && items()[0].querySelector('.agent-session__more [aria-expanded="true"]')), "菜单键打开选中行的菜单");
    await press(document.activeElement!, "Escape");
    rows[0].focus();
    await press(rows[0], "Delete");
    check(archived[archived.length - 1] === "a" && document.activeElement === rows[1], "Delete 归档选中行，焦点移到下一行");
    await press(rows[1], "Backspace");
    check(archived[archived.length - 1] === "b", "Backspace 也归档");
    rows[2].focus();
    const moreShown = () => getComputedStyle(items()[2].querySelector(".agent-session__more")!).opacity === "1";
    check(await until(moreShown), "键盘选中时「⋯」出现");

    await render("list", { withRemoval: false });
    rowButtons()[0].focus();
    await press(rowButtons()[0], "Delete");
    await openMenu(rowButtons()[0]);
    check(archived.length === 3 && menu() && !menuLabels().includes("归档"), "不能归档时 Delete 不动，菜单里也没有「归档」");
    await closeMenu();

    await render("list");
    const anchor = items()[0].querySelector<HTMLElement>(".agent-session__hover")!;
    const hoveredAt = performance.now();
    await act(async () => { anchor.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, clientX: 200 })); });
    const card = await until(hoverCard);
    const shownAfter = performance.now() - hoveredAt;
    check(card && shownAfter >= HOVER_DELAY_MS - 50, `悬停不到一会儿不出卡片（${Math.round(shownAfter)}ms 后出现）`);
    const lines = [...(card?.querySelectorAll(".island-hover-card__line") ?? [])].map((line) => line.textContent);
    check(lines[0] === `fuyu · ${SESSIONS[0].title}` && lines[1] === "你：给 Agent 页的会话行加上右键菜单和键盘操作" && lines[2] === "目录：E:\\Projects\\fuyu" && lines[3] === "在 Windows Terminal 里运行",
      "悬停一会儿出卡片：完整标题、最近提问、目录、宿主");
    check(card && getComputedStyle(card).whiteSpace === "normal" && card.getBoundingClientRect().width <= 362, "卡片里长标题换行，不撑出窗口");
    await openMenu(rowButtons()[0]);
    check(await until(() => menu() && !hoverCard()), "打开菜单时悬停卡片收起");
    await closeMenu();
    await act(async () => { anchor.dispatchEvent(new PointerEvent("pointerout", { bubbles: true })); });

    const remoteAnchor = items()[2].querySelector<HTMLElement>(".agent-session__hover")!;
    await act(async () => { remoteAnchor.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, clientX: 200 })); });
    check(await until(() => hoverCard()?.textContent?.includes("目录：devbox:/home/tixxin/fuyu")), "远程会话的卡片写主机名和远程路径");
    await act(async () => { remoteAnchor.dispatchEvent(new PointerEvent("pointerout", { bubbles: true })); });

    const alert: AlertedSession = { key: "claudeCode:a", kind: "completed", session: SESSIONS[0], rowHeight: 78, measure: () => undefined };
    await render("list", { reveal: alert });
    check(!document.querySelector(".agent-session__hover") && !document.querySelector(".agent-session__more"), "弹出提醒里没有悬停卡片和行菜单");

    for (const view of ["cards", "compact"] as const) {
      await menuChecks(view);
      const cards = rowButtons();
      cards[0].focus();
      await press(cards[0], "ArrowDown");
      check(document.activeElement === cards[1], `${view}：↓ 选下一张`);
      check(items()[0].querySelector(".agent-session__hover"), `${view}：也有悬停卡片`);
      const more = items()[0].querySelector<HTMLElement>(".agent-session__more")!.getBoundingClientRect();
      const archive = items()[0].querySelector<HTMLElement>(".agent-session__archive")!.getBoundingClientRect();
      const meta = items()[0].querySelector<HTMLElement>(".agent-card__heading .agent-provider-icon")!.getBoundingClientRect();
      check(more.right <= archive.left && meta.right <= more.left + 1, `${view}：「⋯」在归档左边，不压住图标`);
    }

    fixture.style.width = "400px";
    await render("list");
    const narrow = items()[0];
    const more = narrow.querySelector<HTMLElement>(".agent-session__more button")!.getBoundingClientRect();
    const archive = narrow.querySelector<HTMLElement>(".agent-session__archive")!.getBoundingClientRect();
    const agent = narrow.querySelector<HTMLElement>(".agent-session__agent")!;
    const icon = agent.getBoundingClientRect();
    check(more.right <= archive.left && Math.abs((icon.left + icon.right) / 2 - (more.left + more.right) / 2) < 1.5 && archive.right <= narrow.getBoundingClientRect().right,
      "400 宽：「⋯」在归档左边，正好在 Agent 图标的位置");
    rowButtons()[0].focus();
    check(await until(() => getComputedStyle(agent).opacity === "0" && getComputedStyle(narrow.querySelector(".agent-session__more")!).opacity === "1"), "选中这一行时 Agent 图标换成「⋯」，不叠在一起");
    await openMenu(rowButtons()[0]);
    const box = menu()!.getBoundingClientRect();
    check(box.left >= 0 && box.right <= window.innerWidth && [...menu()!.querySelectorAll("span")].every((span) => span.scrollWidth <= span.clientWidth + 1), "400 宽：菜单不出窗口，文字不溢出");
    await closeMenu();

    results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
    results.dataset.result = "passed";
  } catch (error) {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
    console.error(error);
  }
}

await runChecks();
