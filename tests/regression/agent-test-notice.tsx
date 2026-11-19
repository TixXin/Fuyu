import { act, StrictMode, useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import { emit } from "@tauri-apps/api/event";
import { mockIPC } from "@tauri-apps/api/mocks";
import { AGENT_TEST_NOTICE_EVENT, AGENT_TEST_NOTICE_RESULT_EVENT, type AgentSessionSummary } from "../../src/features/agent-status/api";
import { AgentSessionsPanel } from "../../src/features/agent-status/AgentSessionsPanel";
import type { AgentApprovalRequest } from "../../src/features/agent-status/approvals/api";
import { AGENT_APPROVAL_STORAGE_KEY, saveAgentApprovalSettings } from "../../src/features/agent-status/approvals/storage";
import { noticeOptionsOf } from "../../src/features/agent-status/notice/noticeOptions";
import type { PreviewEvent } from "../../src/features/agent-status/reminder-settings/previewEvents";
import { previewSamples } from "../../src/features/agent-status/reminder-settings/previewSamples";
import { DEFAULT_AGENT_SOUND_SETTINGS, saveAgentSoundSettings } from "../../src/features/agent-status/sounds/storage";
import { isTestSession, testNoticeRequest } from "../../src/features/agent-status/testNotice";
import { useIslandAgentAlerts } from "../../src/features/agent-status/useIslandAgentAlerts";
import type { IslandHost } from "../../src/features/plugin-kernel/islandHost";
import { zhCN } from "../../src/i18n/sections/settings/agentNotice";
import { DEFAULT_SETTINGS } from "../../src/lib/settings/settingsDefaults";
import type { IslandSettings } from "../../src/lib/settings/types";
import { until } from "./pollUntil";
import "../../src/styles/tokens.css";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });
saveAgentSoundSettings({ ...DEFAULT_AGENT_SOUND_SETTINGS, enabled: false });
saveAgentApprovalSettings({ onIsland: true, whenInFront: true });

const STAY_MS = 400;
const SETTINGS: IslandSettings = { ...DEFAULT_SETTINGS, agentAlertSeconds: STAY_MS / 1000, agentAlertStarted: "off" };
const SAMPLE = zhCN.preview.sample;
const samples = previewSamples(SAMPLE);
const REAL: AgentApprovalRequest = {
  id: 41, kind: "permission", agent: "claudeCode", sessionId: "real", cwd: "/Users/me/projects/Fuyu", toolName: "Bash",
  toolInput: { command: "git push origin main" }, permissionSuggestions: null, receivedAt: 0,
};
const LISTED: AgentSessionSummary[] = [{
  provider: "claudeCode", sessionId: "real", cwd: "/Users/me/projects/Fuyu", title: "真的会话", model: null, effort: null,
  phase: "waiting", lastMessage: null, updatedAt: 0, host: null, turnStartedAt: null,
}];
const NO_UNSEEN = new Set<string>();
const never = async () => () => {};
const host: IslandHost = { listenHover: never, listenOutsideClick: never, setOutsideClickWatch: async () => {}, listenBannerHover: never, setBannerRect: async () => {} };

const calls: string[] = [];
const decisions: string[] = [];
const answers = new Map<number, string>();
mockIPC(
  (command, args) => {
    const payload = (args ?? {}) as Record<string, unknown>;
    calls.push(command);
    if (command === "agent_approval_decide") decisions.push(`${String(payload.id)}:${String(payload.decision)}`);
    if (command === "agent_sessions_in_front" || command === "agent_approval_pending") return [];
    return null;
  },
  { shouldMockEvents: true },
);
type Invoke = (command: string, args?: unknown, options?: unknown) => Promise<unknown>;
const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: Invoke } }).__TAURI_INTERNALS__;
const mockedInvoke = internals.invoke;
internals.invoke = (command, args, options) => {
  const sent = (args ?? {}) as { target?: { label?: string }; event?: string; payload?: { id: number; outcome: string } };
  if (command === "plugin:event|emit_to" && sent.event === AGENT_TEST_NOTICE_RESULT_EVENT && sent.target?.label === "settings" && sent.payload) {
    answers.set(sent.payload.id, sent.payload.outcome);
  }
  return mockedInvoke(command, args, options);
};

type Island = { mode: "collapsed" | "expanded"; page: string };
type Alerts = ReturnType<typeof useIslandAgentAlerts>;
let island: Island = { mode: "collapsed", page: "todo" };
const live: { alerts: Alerts | null } = { alerts: null };
let setIsland: (island: Island) => void;
let setEnabled: (value: boolean) => void;

function Harness() {
  const [state, changeIsland] = useState<Island>(island);
  const [enabled, changeEnabled] = useState(true);
  setIsland = changeIsland;
  setEnabled = changeEnabled;
  island = state;
  const openIslandPage = useCallback((page: "agents") => changeIsland({ mode: "expanded", page }), []);
  const collapseIsland = useCallback(() => changeIsland((current) => ({ ...current, mode: "collapsed" })), []);
  const shown = useIslandAgentAlerts({ sessions: LISTED, unseen: NO_UNSEEN, settings: SETTINGS, enabled, mode: state.mode, page: state.page, openIslandPage, collapseIsland, host });
  live.alerts = shown;
  if (state.mode !== "expanded" || state.page !== "agents") return null;
  return (
    <AgentSessionsPanel
      sessions={LISTED}
      hostDisplay="off"
      reveal={shown.alertedSession}
      stack={shown.alertedStack}
      approvals={shown.approvals}
      notice={noticeOptionsOf(SETTINGS)}
      onOpenAgentPage={shown.alertedSession?.openAgentPage}
    />
  );
}

let lastId = 100;
const wait = (ms: number) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });
const send = async (event: PreviewEvent) => {
  const id = (lastId += 1);
  await act(async () => { await emit(AGENT_TEST_NOTICE_EVENT, testNoticeRequest(event, samples, id)); });
  return (await until(() => answers.get(id))) ?? null;
};
const open = () => island.mode === "expanded" && island.page === "agents";
const title = () => document.querySelector("#fixture .agent-notice__title")?.textContent ?? "";
const card = () => document.querySelector("#fixture .agent-approval");
const button = (name: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("#fixture .agent-notice__button")].find((item) => item.querySelector(".agent-notice__label")?.textContent === name);
const click = (target: HTMLElement | null | undefined) => act(async () => { target?.click(); });
const storage = (key: string) => act(async () => { window.dispatchEvent(new StorageEvent("storage", { key })); });
const messages: string[] = [];
function check(condition: unknown, label: string) {
  if (!condition) throw new Error(label);
  messages.push(`PASS ${label}`);
}
const results = document.getElementById("results")!;

try {
  await act(async () => { createRoot(document.getElementById("fixture")!).render(<StrictMode><Harness /></StrictMode>); });
  await wait(50);
  check(island.mode === "collapsed", "没有测试也没有提醒时岛收着");

  check((await send("approval")) === "shownCard" && (await until(() => open() && card())), "试「等你确认」：岛打开 Agent 页，显示审批卡片，回给设置窗口的是「显示成卡片」");
  check(title().includes(SAMPLE.approvalTitle), "卡片用设置窗口带过来的样例标题");
  check(live.alerts?.alertedSession && isTestSession(live.alerts.alertedSession.session) && live.alerts.approvals.current && live.alerts.approvals.current.id < 0, "测试用的会话和请求都带测试专用的编号");
  await until(() => button("允许") && !button("允许")!.disabled);
  await click(button("允许"));
  check((await until(() => island.mode === "collapsed")) && decisions.length === 0, "点「允许」岛就收起，没有回复任何 Agent");

  check((await send("question")) === "shownCard" && (await until(() => document.querySelector("#fixture .agent-question"))), "试「提问」：显示提问卡片");
  await until(() => button("到终端") && !button("到终端")!.disabled);
  await click(button("到终端"));
  check((await until(() => island.mode === "collapsed")) && decisions.length === 0 && !calls.includes("focus_agent_window"), "点「到终端」也只是收起，不去找窗口");

  check((await send("done")) === "shown" && (await until(() => open() && title().includes(SAMPLE.doneTitle))) && !card(), "试「完成」：显示完成的通知");
  check(await until(() => island.mode === "collapsed", STAY_MS + 2000), "停留时间到了自己收起");

  check((await send("stack")) === "shown" && (await until(() => live.alerts?.alertedStack.length === 3)), "试「多个会话」：三条通知叠在一起");
  await click(document.querySelector<HTMLElement>("#fixture .agent-notice"));
  await wait(50);
  check(!calls.includes("focus_agent_window"), "点测试通知不去找会话窗口");

  check((await send("approval")) === "shownCard" && (await until(() => card() && live.alerts?.alertedStack.length === 1)), "上一条测试还在时再试一条，新的换掉旧的");
  check((await send("failed")) === "shown" && (await until(() => !card() && title().includes(SAMPLE.failedTitle))) && open(), "审批的测试没点就换成「出错」，岛不用先收起");

  await act(async () => { await emit("agent-approval-requested", REAL); });
  check(await until(() => live.alerts?.approvals.current?.id === REAL.id && title().includes("真的会话")), "来了真的审批，测试通知让位");
  check((await send("done")) === "busy" && live.alerts?.approvals.current?.id === REAL.id, "真的审批在岛上时试一条：回「忙」，真的还在");
  await until(() => button("允许") && !button("允许")!.disabled);
  await click(button("允许"));
  check((await until(() => decisions.join() === `${REAL.id}:allow` && island.mode === "collapsed")) && !live.alerts?.alertedSession, "真的审批照常回给 Agent，处理完岛收起，测试通知不再冒出来");

  await act(async () => setEnabled(false));
  check((await send("done")) === "muted" && island.mode === "collapsed", "游戏模式勿扰或 Agent 功能关着时：回「不弹」，岛不动");
  await act(async () => setEnabled(true));

  await act(async () => setIsland({ mode: "expanded", page: "todo" }));
  check((await send("done")) === "expanded" && island.page === "todo", "你正在用展开的岛时：回「展开着」，不抢页面");
  await act(async () => setIsland({ mode: "collapsed", page: "todo" }));

  saveAgentApprovalSettings({ onIsland: false, whenInFront: true });
  await storage(AGENT_APPROVAL_STORAGE_KEY);
  check((await send("approval")) === "shown" && (await until(() => open() && title().includes(SAMPLE.approvalTitle))) && !card(), "「在岛上审批」关着时，等你确认显示成等你处理的通知");
  await act(async () => setIsland({ mode: "collapsed", page: "agents" }));
  check((await until(() => !live.alerts?.alertedSession)) && decisions.length === 1, "手动收起岛，测试通知跟着清掉");

  results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
  results.dataset.result = "passed";
} catch (error) {
  results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
  results.dataset.result = "failed";
  console.error(error);
}
