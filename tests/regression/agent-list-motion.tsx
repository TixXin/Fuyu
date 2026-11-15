import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import { I18nProvider } from "../../src/i18n";
import { AgentSessionsPanel } from "../../src/features/agent-status/AgentSessionsPanel";
import type { AgentSessionGroup, AgentSessionView } from "../../src/features/appearance/types";
import type { AgentSessionSummary } from "../../src/features/agent-status/api";
import type { AlertedSession } from "../../src/features/agent-status/useAgentAlerts";
import type { SessionRemoval } from "../../src/features/agent-status/useHiddenSessions";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });
mockIPC((command) => {
  if (command === "list_agent_effort_labels") return {};
  if (command === "focus_agent_window") return true;
  return null;
});

const now = Date.now();
const session = (id: string, minutes: number, phase: AgentSessionSummary["phase"] = "completed", extra: Partial<AgentSessionSummary> = {}): AgentSessionSummary => ({
  provider: "claudeCode", sessionId: id, cwd: `E:\\Projects\\${id}`, title: `会话 ${id}`, model: null, effort: null,
  phase, lastMessage: null, updatedAt: now - minutes * 60_000, host: null, turnStartedAt: null, ...extra,
});

const FIRST = [session("a", 1, "running"), session("b", 2), session("c", 3)];
const REORDERED = [session("a", 4, "running"), session("b", 2), session("c", 1)];

const fixture = document.getElementById("fixture")!;
const root = createRoot(fixture);
const results = document.getElementById("results")!;
const messages: string[] = [];
function check(condition: unknown, label: string) {
  if (!condition) throw new Error(label);
  messages.push(`PASS ${label}`);
}
const wait = (ms: number) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });

type Props = { view?: AgentSessionView; group?: AgentSessionGroup; removal?: SessionRemoval; reveal?: AlertedSession | null };
const draw = (sessions: AgentSessionSummary[], props: Props = {}) => root.render(
  <StrictMode><I18nProvider>
    <AgentSessionsPanel sort="recent" group={props.group ?? "none"} view={props.view ?? "list"} sessions={sessions} hostDisplay="off" removal={props.removal} reveal={props.reveal} />
  </I18nProvider></StrictMode>,
);
const render = (sessions: AgentSessionSummary[], props: Props = {}) => act(async () => draw(sessions, props));

const items = () => [...document.querySelectorAll<HTMLElement>(".agent-sessions__list > li")];
const row = (key: string) => document.querySelector<HTMLElement>(`.agent-sessions__list > [data-session-key="${CSS.escape(key)}"]`)!;
const keys = () => items().filter((item) => item.dataset.sessionKey).map((item) => item.dataset.sessionKey!);
const moving = (item: HTMLElement) => item.getAnimations().some((animation) => animation.playState === "running");
const transformed = (item: HTMLElement) => getComputedStyle(item).transform !== "none";
const ghosts = () => document.querySelectorAll(".agent-motion-ghost").length;
const settled = () => items().every((item) => !moving(item) && !transformed(item));
const inOrder = (expected: string[]) => {
  const tops = expected.map((key) => row(key).getBoundingClientRect().top);
  return keys().join() === expected.join() && tops.every((top, index) => index === 0 || top > tops[index - 1]);
};

async function reorderIn(view: AgentSessionView) {
  await render(FIRST, { view });
  await wait(50);
  check(keys().join() === "claudeCode:a,claudeCode:b,claudeCode:c" && settled(), `${view}：首次显示不动`);
  const before = row("claudeCode:c").getBoundingClientRect().top;
  await render(REORDERED, { view });
  const c = row("claudeCode:c");
  check(keys().join() === "claudeCode:c,claudeCode:b,claudeCode:a", `${view}：重排后 DOM 顺序变成 c、b、a`);
  check(moving(c) && transformed(c) && Math.abs(c.getBoundingClientRect().top - before) < 4, `${view}：重排的一刻 c 留在旧位置，带着 transform 往新位置走`);
  check(moving(row("claudeCode:a")), `${view}：被挤下去的 a 也在平移`);
  await wait(320);
  check(settled() && inOrder(["claudeCode:c", "claudeCode:b", "claudeCode:a"]), `${view}：动画结束后各行停在新位置，没有残留 transform`);
}

async function runChecks() {
  try {
    for (const view of ["list", "cards", "compact"] as const) await reorderIn(view);

    await render(REORDERED);
    await wait(320);
    await render([session("d", 0), ...REORDERED]);
    const d = row("claudeCode:d");
    check(moving(d) && Number(getComputedStyle(d).opacity) < 0.5, "新会话淡入");
    check(moving(row("claudeCode:c")), "新会话插到上面时，下面的行往下让");
    await wait(320);
    check(settled() && getComputedStyle(d).opacity === "1", "淡入结束后完全不透明");

    await render([session("d", 0), ...REORDERED].filter((item) => item.sessionId !== "b"));
    check(ghosts() === 1 && !row("claudeCode:b") && keys().length === 3, "会话退出时留一个收起中的影子，DOM 里已经没有它");
    check(document.querySelector<HTMLElement>(".agent-motion-ghost")?.getAttribute("aria-hidden") === "true", "影子对读屏隐藏");
    await wait(320);
    check(ghosts() === 0 && settled(), "收起结束后影子移除");

    const waiting = [session("a", 4, "running"), session("c", 1)];
    await render(waiting);
    await wait(50);
    await render([session("a", 4, "waiting"), session("c", 1)]);
    const pulsing = row("claudeCode:a");
    check(pulsing.classList.contains("agent-motion-pulse")
      && getComputedStyle(pulsing.querySelector(".agent-session__dot")!).animationName === "agent-motion-dot-pulse", "变成等你时圆点脉冲一次");
    await render([session("a", 4, "waiting", { lastMessage: "x" }), session("c", 1)]);
    await wait(900);
    check(!pulsing.classList.contains("agent-motion-pulse"), "脉冲结束后去掉标记，不反复闪");

    const remote = session("r", 0, "completed", { remoteHost: "devbox" });
    await render([session("a", 1), remote], { group: "computer" });
    await wait(50);
    const heading = row('group:["devbox",null]');
    check(heading?.classList.contains("agent-sessions__computer"), "分组标题也带行的 key");
    await render([session("a", 1), session("n", 0), remote], { group: "computer" });
    check(moving(heading) && transformed(heading), "本机多了一个会话时，远程分组标题往下平移");
    await wait(320);

    let listed = [...REORDERED];
    let removed: AgentSessionSummary | null = null;
    const redraw = () => draw(listed, { removal: { remove, removed, undo } });
    function remove(item: AgentSessionSummary) {
      removed = item;
      listed = listed.filter((other) => other.sessionId !== item.sessionId);
      redraw();
    }
    function undo() {
      if (removed) listed = [...listed, removed];
      removed = null;
      redraw();
    }
    await act(async () => redraw());
    await wait(50);
    await act(async () => row("claudeCode:b").querySelector<HTMLButtonElement>(".agent-session__archive")!.click());
    check(row("claudeCode:b").dataset.motion === "archiving", "归档中的行打上标记，不参与重排动画");
    await new Promise((resolve) => setTimeout(resolve, 400));
    check(!row("claudeCode:b") && ghosts() === 0, "归档的行走归档动画，移除时不再留影子");
    await wait(320);
    await act(async () => document.querySelector<HTMLButtonElement>(".agent-archived button")!.click());
    const back = row("claudeCode:b");
    check(back && items().filter((item) => item !== back).every((item) => !moving(item)), "撤销归档时只有回来的那行展开，别的行不重复平移");
    await wait(320);

    const card: AlertedSession = { key: "claudeCode:a", kind: "completed", session: REORDERED[0], rowHeight: 78, measure: () => undefined };
    await render(REORDERED, { reveal: card });
    await render(REORDERED.map((item) => item.sessionId === "a" ? { ...item, phase: "waiting" as const } : item), { reveal: card });
    check(items().length === 1 && !moving(items()[0]) && ghosts() === 0 && !items()[0].classList.contains("agent-motion-pulse"), "弹出提醒只有一行，不做动效");

    const original = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => (query.includes("prefers-reduced-motion") ? ({ ...original(query), matches: true, media: query }) : original(query));
    await render(FIRST);
    await wait(50);
    await render([session("a", 4, "waiting"), session("c", 1), session("e", 0)]);
    check(settled() && ghosts() === 0 && !document.querySelector(".agent-motion-pulse"), "系统要求减少动画时，重排、出现、离开、脉冲都不动");
    check(inOrder(["claudeCode:e", "claudeCode:c", "claudeCode:a"]), "减少动画时直接到新位置");
    window.matchMedia = original;

    results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
    results.dataset.result = "passed";
  } catch (error) {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
    console.error(error);
  }
}

await runChecks();
