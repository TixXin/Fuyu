import { act, StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { emit } from "@tauri-apps/api/event";
import { mockIPC } from "@tauri-apps/api/mocks";
import type { AgentSessionSummary } from "../../src/features/agent-status/api";
import type { AgentApprovalRequest } from "../../src/features/agent-status/approvals/api";
import { AGENT_APPROVAL_STORAGE_KEY } from "../../src/features/agent-status/approvals/storage";
import { DEFAULT_SETTINGS } from "../../src/lib/settings/settings";
import type { IslandSettings } from "../../src/lib/settings/types";
import { useIslandAgentAlerts } from "../../src/features/agent-status/useIslandAgentAlerts";
import { islandHost } from "../../src/windows/island/islandHost";
import type { IslandPage } from "../../src/windows/island/types";
import { until } from "./pollUntil";
import { NoticeGallery, STYLES } from "./agentNoticeGallery";
import "../../src/styles/tokens.css";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });
localStorage.setItem(AGENT_APPROVAL_STORAGE_KEY, JSON.stringify({ onIsland: true, whenInFront: false }));
const decisions: string[] = [];
let watchingOutside = false;
mockIPC(
  (command, args) => {
    const payload = args as Record<string, unknown>;
    if (command === "agent_sessions_in_front") return [];
    if (command === "agent_approval_pending") return [];
    if (command === "agent_approval_decide") decisions.push(`${String(payload.id)}:${String(payload.decision)}`);
    if (command === "set_island_outside_click_watch") watchingOutside = Boolean(payload.watch);
    return null;
  },
  { shouldMockEvents: true },
);

const SETTINGS: IslandSettings = { ...DEFAULT_SETTINGS, agentAlertSeconds: 30, agentRemindSeconds: 0 };
const session = (phase: AgentSessionSummary["phase"]): AgentSessionSummary => ({
  provider: "claudeCode", sessionId: "s1", cwd: null, title: "s1", model: null, effort: null,
  phase, lastMessage: null, updatedAt: 0, host: null, turnStartedAt: null,
});
const request = (id: number): AgentApprovalRequest => ({
  id, kind: "permission", agent: "claudeCode", sessionId: "s1", cwd: null, toolName: "Bash",
  toolInput: { command: "echo hi" }, permissionSuggestions: null, receivedAt: 0,
});

type Island = { mode: "collapsed" | "expanded"; page: IslandPage };
let island: Island = { mode: "collapsed", page: "todo" };
let setSessions: (sessions: AgentSessionSummary[]) => void;
let decide: ((decision: "allow") => void) | null = null;

function Harness() {
  const [sessions, changeSessions] = useState<AgentSessionSummary[]>([session("running")]);
  const [state, changeIsland] = useState<Island>(island);
  setSessions = changeSessions;
  island = state;
  const { approvals } = useIslandAgentAlerts({
    sessions,
    unseen: new Set(),
    settings: SETTINGS,
    enabled: true,
    mode: state.mode,
    page: state.page,
    host: islandHost,
    openIslandPage: (page: "agents") => changeIsland({ mode: "expanded", page }),
    collapseIsland: () => changeIsland((current) => ({ ...current, mode: "collapsed" })),
  });
  decide = approvals.current ? approvals.decide : null;
  return null;
}

const press = (id: string) => act(async () => { document.getElementById(id)!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); });
const messages: string[] = [];
function check(condition: unknown, label: string) {
  if (!condition) throw new Error(label);
  messages.push(`PASS ${label}`);
}
const results = document.getElementById("results")!;

async function waitThenCard(id: number) {
  await act(async () => setSessions([session("running")]));
  await act(async () => setSessions([session("waiting")]));
  await act(async () => { await emit("agent-approval-requested", request(id)); });
  await until(() => decide !== null);
  await press("card");
}

try {
  await act(async () => { createRoot(document.getElementById("fixture")!).render(<StrictMode><Harness /></StrictMode>); });

  await act(async () => setSessions([session("completed")]));
  await until(() => island.mode === "expanded" && watchingOutside);
  check(island.mode === "expanded" && watchingOutside, "会话完成弹出提醒时，开始留意岛屿外的点击");
  await act(async () => { await emit("island-outside-click", null); });
  await until(() => island.mode === "collapsed" && !watchingOutside);
  check(island.mode === "collapsed" && !watchingOutside, "点了岛屿外面，提醒收起，停止留意");

  await waitThenCard(1);
  check(island.mode === "expanded" && island.page === "agents" && decide, "会话等待确认时弹出 Agent 页，审批卡片出现");
  check(!watchingOutside, "有审批卡片时不因为点外面就关（请求还在等）");
  await act(async () => decide?.("allow"));
  await until(() => decisions.includes("1:allow") && island.mode === "collapsed");
  check(decisions.includes("1:allow") && island.mode === "collapsed", "在卡片上选了以后，岛屿收起");

  await waitThenCard(2);
  await act(async () => { await emit("agent-approval-closed", { id: 2, reason: "disconnected" }); });
  await until(() => island.mode === "collapsed");
  check(island.mode === "collapsed", "在终端里处理了（卡片撤掉），岛屿收起");

  await waitThenCard(3);
  await press("elsewhere");
  await act(async () => { await emit("agent-approval-closed", { id: 3, reason: "handedBack" }); });
  await until(() => decide === null);
  check(island.mode === "expanded", "点了卡片以外的地方（接管了岛屿），卡片结束后不替你收起");

  await act(async () => { createRoot(document.getElementById("notices")!).render(<NoticeGallery />); });
  const $ = (frame: string, selector: string) => document.querySelector<HTMLElement>(`#${frame} ${selector}`);
  const $$ = (frame: string, selector: string) => [...document.querySelectorAll<HTMLElement>(`#${frame} ${selector}`)];
  const shown = (element: Element | null) => Boolean(element) && getComputedStyle(element!).display !== "none";
  await until(() => $("status-done", ".agent-notice-message__thumb"));
  for (const style of STYLES) {
    const tones = ["working", "needs", "yourTurn", "done", "failed"].filter((tone) => $(`${style}-${tone}`, `.agent-notice--${style}.agent-notice--tone-${tone}`));
    check(tones.length === 5, `${style} 样式下五种状态都画成同一种通知卡（${tones.join("、")}）`);
    check($(`${style}-approval`, `.agent-approval.agent-notice--${style}.agent-notice--tone-needs`) && $(`${style}-question`, `.agent-question.agent-notice--${style}`), `${style} 样式下审批卡和提问卡也用同一套外框`);
  }
  check($("status-done", ".agent-notice__headline")?.textContent === "这一轮完成了" && $("status-needs", ".agent-notice__headline")?.textContent === "等你确认 · Bash", "状态优先样式大字写状态句，带工具名");
  check($("compact-yourTurn", ".agent-notice__state")?.textContent === "等你回复", "精简两行样式右上角写状态字");
  check(!shown($("wings-working", ".agent-notice__drop")) && shown($("wings-done", ".agent-notice__drop")), "两翼样式运行中只有两翼，其余状态往下长出正文");

  const text = $("status-done", ".agent-notice-message__text")!;
  const lineHeight = parseFloat(getComputedStyle(text).lineHeight);
  check(Math.abs(text.clientHeight - 6 * lineHeight) < 2 && text.scrollHeight > text.clientHeight + lineHeight, `长消息按设置显示 6 行（${text.clientHeight}px），超出在卡片里滚动`);
  const compactText = $("compact-done", ".agent-notice-message__text")!;
  check(Math.abs(compactText.clientHeight - 4 * lineHeight) < 2, `消息行数设成 4 时只显示 4 行（${compactText.clientHeight}px）`);
  check(text.hasAttribute("data-fade-bottom") && !text.hasAttribute("data-fade-top"), "下面还有内容时底部渐隐，顶部不渐隐");
  check($("status-done", ".agent-notice-message__markdown ol") && $("status-done", ".agent-notice-message__markdown pre"), "消息按 Markdown 显示列表和代码块");
  check(getComputedStyle($("status-done", ".agent-notice-message__thumb")!).opacity === "0", "滚动条平时不显示");
  let leaked = false;
  const outer = () => { leaked = true; };
  document.getElementById("notices")!.addEventListener("wheel", outer);
  const wheel = new WheelEvent("wheel", { deltaY: 30, deltaMode: 0, bubbles: true, cancelable: true });
  await act(async () => { text.dispatchEvent(wheel); });
  await until(() => text.hasAttribute("data-fade-top"));
  check(wheel.defaultPrevented && !leaked && text.scrollTop > 0 && text.hasAttribute("data-fade-top"), "滚轮在正文里滚动，不传给岛；滚下去后顶部渐隐");
  check($("status-done", ".agent-notice-message__thumb--on"), "滚动时滚动条完全显示");
  await until(() => !$("status-done", ".agent-notice-message__thumb--on"), 3000);
  check(!$("status-done", ".agent-notice-message__thumb--on"), "停下后滚动条淡出");
  document.getElementById("notices")!.removeEventListener("wheel", outer);

  check($("plain-inline", ".agent-notice-message__plain") && !$("plain-inline", "pre"), "关掉 Markdown 时按纯文字显示");
  check($("plain-inline", ".agent-notice__meta")?.textContent?.includes("Opus 5.5") && $("plain-inline", ".agent-notice__meta")?.textContent?.includes("你："), "元信息设成通知里也显示时，模型和「你：」出现在正文上面");
  check(!$("status-done", ".agent-notice__meta"), "元信息默认只在悬停卡里");
  check(getComputedStyle($("plain-inline", ".agent-notice-message__thumb")!).opacity !== "0", "滚动条设成一直显示时平时也看得到");

  const ids = (frame: string) => $$(frame, ".agent-notice__button").map((button) => button.className.match(/agent-notice__button--(\w+)/)?.[1]);
  check(ids("status-approval").join() === "deny,terminal,allow" && $("status-approval", ".agent-notice__button--allow.agent-notice__button--primary"), "审批按钮默认「拒绝 · 到终端 · 允许」，允许是主按钮");
  check(ids("allow-first").join() === "allow,terminal,deny" && !$("allow-first", ".agent-notice__key"), "按钮顺序可以对调，可以不显示快捷键");
  check(shown($("status-approval", ".agent-notice__key")), "宽岛上按钮显示快捷键");
  check(!shown($("compact-narrow", ".agent-notice__button--terminal")) && !shown($("compact-narrow", ".agent-notice__key")), "精简两行窄于 300 时收起「到终端」和快捷键");
  check(!shown($("status-narrow", ".agent-notice__label")) && shown($("status-narrow", ".agent-notice__button-icon")), "状态优先窄于 300 时按钮只剩图标");
  check([...document.querySelectorAll<HTMLElement>("#notices .agent-notice")].every((card) => card.scrollWidth <= card.clientWidth + 1), "卡片里没有横向溢出");
  const thumbs = [...document.querySelectorAll<HTMLElement>("#notices .agent-notice-message__thumb")];
  const fits = thumbs.every((thumb) => {
    const track = thumb.parentElement!.querySelector<HTMLElement>(".agent-notice-message__text")!;
    const ratio = track.clientHeight / track.scrollHeight;
    const height = thumb.getBoundingClientRect().height;
    const offset = thumb.getBoundingClientRect().top - track.getBoundingClientRect().top;
    return Math.abs(height - Math.max(18, track.clientHeight * ratio)) < 1 && offset >= -0.5 && offset + height <= track.clientHeight + 0.5;
  });
  check(thumbs.length > 0 && fits, `滚动条长度按可见比例算、不超出正文（${thumbs.length} 条）`);
  const scrolled = $("status-done", ".agent-notice-message__text")!;
  const thumbTop = $("status-done", ".agent-notice-message__thumb")!.getBoundingClientRect().top - scrolled.getBoundingClientRect().top;
  check(thumbTop > 0, "滚下去以后滚动条跟着往下移");
  for (const thumb of thumbs) thumb.removeAttribute("style");

  results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
  results.dataset.result = "passed";
} catch (error) {
  results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
  results.dataset.result = "failed";
  console.error(error);
}
