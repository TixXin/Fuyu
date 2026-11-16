import { act, StrictMode } from "react";
import type { Root } from "react-dom/client";
import { I18nProvider } from "../../src/i18n";
import { AgentSessionsPanel } from "../../src/features/agent-status/AgentSessionsPanel";
import type { AgentSessionSummary } from "../../src/features/agent-status/api";
import { getAgentPageExpandedHeight } from "../../src/features/agent-status/islandLayout";

type Context = { root: Root; fixture: HTMLElement; sessions: AgentSessionSummary[]; check: (condition: unknown, label: string) => void; chromeHeight: number };

const settle = (ms = 30) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });

export async function checkChildSessions({ root, fixture, sessions, check, chromeHeight }: Context) {
  const now = Date.now();
  const render = async (list: AgentSessionSummary[]) => {
    await act(async () => {
      root.render(<StrictMode><I18nProvider><AgentSessionsPanel sort="recent" sessions={list} hostDisplay="both" /></I18nProvider></StrictMode>);
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
  };
  const parent = sessions[0];
  const child: AgentSessionSummary = {
    ...sessions[2], sessionId: "child-1", parentId: parent.sessionId, title: "B50 子会话挂到父会话下", phase: "waiting", updatedAt: now - 30_000, subagents: 0,
  };
  const grandchild: AgentSessionSummary = {
    ...sessions[2], sessionId: "child-2", parentId: "child-1", title: "孙会话：跑回归页", phase: "running", updatedAt: now - 60_000, subagents: 0,
  };
  const orphan: AgentSessionSummary = { ...sessions[2], sessionId: "child-3", parentId: "gone", title: "父会话不在列表里", updatedAt: now - 120_000, subagents: 0 };
  const list = [parent, child, grandchild, ...sessions.slice(1), orphan];
  fixture.style.height = `${getAgentPageExpandedHeight(5) - chromeHeight}px`;
  await render(list);

  const keys = () => [...document.querySelectorAll<HTMLLIElement>(".agent-sessions__list > li[data-session-key]:not(.agent-motion-ghost)")].map((item) => item.dataset.sessionKey);
  const toggle = () => document.querySelector<HTMLButtonElement>(".agent-session-children .agent-subagents__toggle");
  const item = (id: string) => document.querySelector<HTMLLIElement>(`.agent-sessions__list > li[data-session-key="claudeCode:${id}"]`);
  check(!item("child-1") && !item("child-2") && item("child-3"), `子会话默认收起不单独占一行，父会话不在列表里的照常显示：${keys().join(", ")}`);
  const button = toggle();
  check(button && item(parent.sessionId)?.contains(button) && !button.closest(".agent-session"), "子会话按钮在父行里，不嵌在会话行的按钮里");
  check(button?.getAttribute("aria-expanded") === "false" && button.textContent?.startsWith("2 个子会话"), `按钮写「2 个子会话」，默认收起：${button?.textContent}`);
  check(button?.querySelector(".agent-session-children__ask--needs")?.textContent === "1 个要你看"
    && button.getAttribute("aria-label") === "展开 2 个子会话 · 1 个要你看", "收起时子会话在等你确认，父行的按钮上看得出来，读屏也念出来");

  await act(async () => { button!.click(); });
  await settle(250);
  const order = keys();
  const at = order.indexOf(`claudeCode:${parent.sessionId}`);
  check(order[at + 1] === "claudeCode:child-1" && order[at + 2] === "claudeCode:child-2", `展开后子会话按层级紧跟在父行下面：${order.join(", ")}`);
  check(toggle()?.getAttribute("aria-expanded") === "true" && !toggle()?.querySelector(".agent-session-children__ask"), "展开后按钮标成已展开，不再重复提示");
  const left = (id: string) => item(id)!.querySelector(".agent-session")!.getBoundingClientRect().left;
  check(left("child-1") > left(parent.sessionId) + 8 && left("child-2") > left("child-1") + 8, "子会话缩进，孙会话再缩进一格");
  check(item("child-1")?.querySelector(".agent-session--light-needs"), "子会话仍是完整的会话行，带自己的状态灯");

  const parentRow = item(parent.sessionId)!.querySelector<HTMLButtonElement>(".agent-session")!;
  parentRow.focus();
  await act(async () => { parentRow.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })); });
  check(document.activeElement === item("child-1")?.querySelector(".agent-session"), "方向键能从父行走到子会话");
  const panel = document.querySelector<HTMLElement>(".agent-sessions__list")!;
  check(panel.scrollWidth <= panel.clientWidth, "子会话的缩进不撑出横向滚动");

  await act(async () => { toggle()!.click(); });
  await settle(250);
  check(!item("child-1") && toggle()?.getAttribute("aria-expanded") === "false", "再点一下收起");

  await render(list.filter((session) => session.sessionId !== parent.sessionId));
  check(item("child-1") && !item("child-2") && item("child-1")?.contains(toggle()) && toggle()?.textContent?.startsWith("1 个子会话"),
    "父会话归档或不在了，子会话照常单独显示，孙会话改挂到它下面");

  await settle(250);
  await render(sessions);
}
