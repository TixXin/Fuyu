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

  results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
  results.dataset.result = "passed";
} catch (error) {
  results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
  results.dataset.result = "failed";
  console.error(error);
}
