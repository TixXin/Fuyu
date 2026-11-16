import { act, StrictMode } from "react";
import type { Root } from "react-dom/client";
import { I18nProvider } from "../../src/i18n";
import { AgentSessionsPanel } from "../../src/features/agent-status/AgentSessionsPanel";
import type { AgentSessionSummary } from "../../src/features/agent-status/api";
import { getAgentPageExpandedHeight } from "../../src/features/agent-status/islandLayout";
import { sampleSubagents } from "./agent-sessions-subagents";

type Context = { root: Root; fixture: HTMLElement; sessions: AgentSessionSummary[]; check: (condition: unknown, label: string) => void; chromeHeight: number };

export async function checkExpandByDefault({ root, fixture, sessions, check, chromeHeight }: Context) {
  const now = Date.now();
  const parent: AgentSessionSummary = { ...sessions[0], subagentList: sampleSubagents(now) };
  const child: AgentSessionSummary = { ...sessions[2], sessionId: "expand-child", parentId: parent.sessionId, title: "默认展开的子会话", updatedAt: now - 30_000, subagents: 0 };
  const list = [parent, child, ...sessions.slice(1)];
  const render = async (expandChildren: boolean) => {
    await act(async () => {
      root.render(<StrictMode><I18nProvider><AgentSessionsPanel sort="recent" sessions={list} hostDisplay="both" expandChildren={expandChildren} /></I18nProvider></StrictMode>);
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
  };
  const subagents = () => document.querySelector<HTMLButtonElement>(".agent-subagents:not(.agent-session-children) .agent-subagents__toggle");
  const children = () => document.querySelector<HTMLButtonElement>(".agent-session-children .agent-subagents__toggle");
  const childRow = () => document.querySelector(`.agent-sessions__list > li[data-session-key="claudeCode:expand-child"]`);
  const state = () => `子 Agent ${subagents()?.getAttribute("aria-expanded")}，子会话 ${children()?.getAttribute("aria-expanded")}`;
  fixture.style.height = `${getAgentPageExpandedHeight(6) - chromeHeight}px`;

  await render(false);
  check(subagents()?.getAttribute("aria-expanded") === "false" && !document.querySelector(".agent-subagent")
    && children()?.getAttribute("aria-expanded") === "false" && !childRow(), `开关关着时子 Agent 和子会话都收起：${state()}`);

  await render(true);
  check(subagents()?.getAttribute("aria-expanded") === "true" && document.querySelectorAll(".agent-subagent").length === 2
    && children()?.getAttribute("aria-expanded") === "true" && childRow(), `开关打开后立即生效，两处都展开：${state()}`);

  await act(async () => { subagents()!.click(); });
  await render(true);
  check(subagents()?.getAttribute("aria-expanded") === "false" && children()?.getAttribute("aria-expanded") === "true",
    `手动收起的那一行照点的来，另一处不受影响：${state()}`);

  await render(false);
  await act(async () => { children()!.click(); });
  check(subagents()?.getAttribute("aria-expanded") === "false" && children()?.getAttribute("aria-expanded") === "true" && childRow(),
    `关掉开关后回到收起，再手动展开子会话照点的来：${state()}`);

  await render(true);
  check(subagents()?.getAttribute("aria-expanded") === "true" && children()?.getAttribute("aria-expanded") === "true", `再打开开关，所有行都回到默认展开：${state()}`);

  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 250)); });
  await act(async () => { root.render(<StrictMode><I18nProvider><AgentSessionsPanel sort="recent" sessions={sessions} hostDisplay="both" /></I18nProvider></StrictMode>); });
}
