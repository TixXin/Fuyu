import { act, StrictMode } from "react";
import type { Root } from "react-dom/client";
import { I18nProvider } from "../../src/i18n";
import { AgentSessionsPanel } from "../../src/features/agent-status/AgentSessionsPanel";
import type { AgentSessionSummary, AgentSubagent } from "../../src/features/agent-status/api";
import { getAgentPageExpandedHeight } from "../../src/windows/island/layout";

type Context = { root: Root; fixture: HTMLElement; sessions: AgentSessionSummary[]; check: (condition: unknown, label: string) => void; chromeHeight: number };

const settle = (ms = 30) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });

export function sampleSubagents(now: number): AgentSubagent[] {
  return [
    {
      id: "ab303ab2ac73a8d7b", description: "摸底其余国内编程代理", agentType: "general-purpose",
      currentTool: { name: "WebSearch", detail: "文心快码 CLI 会话存在哪" }, startedAt: now - 125_000, updatedAt: now - 2_000, background: true, depth: 1,
    },
    {
      id: "a68af05284f0bdeb5", description: "找出所有调用 claude_subagent_calls 的地方", agentType: "Explore",
      currentTool: null, startedAt: now - 40_000, updatedAt: now - 1_000, background: false, depth: 1,
    },
  ];
}

export async function checkSubagents({ root, fixture, sessions, check, chromeHeight }: Context) {
  const now = Date.now();
  const render = async (list: AgentSessionSummary[]) => {
    await act(async () => {
      root.render(<StrictMode><I18nProvider><AgentSessionsPanel sort="recent" sessions={list} hostDisplay="both" /></I18nProvider></StrictMode>);
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
  };
  const withAgents = (agents: AgentSubagent[]) => [{ ...sessions[0], subagentList: agents }, ...sessions.slice(1)];
  fixture.style.height = `${getAgentPageExpandedHeight(3) - chromeHeight}px`;
  await render(withAgents(sampleSubagents(now)));

  const items = () => [...document.querySelectorAll<HTMLLIElement>(".agent-sessions__list > li:not(.agent-motion-ghost)")];
  const toggle = () => document.querySelector<HTMLButtonElement>(".agent-subagents__toggle");
  const first = items()[0];
  const button = toggle();
  check(button && button.textContent === "2 个子 Agent" && button.getAttribute("aria-expanded") === "false", "父行下面有「2 个子 Agent」小按钮，默认收起");
  check(!first.querySelector(".agent-session__meta")?.textContent?.includes("子 Agent"), "有了按钮，标题行的状态里不再重复写子 Agent 数");
  check(button && !button.closest(".agent-session") && button.tabIndex === 0 && button.getAttribute("aria-label") === "展开 2 个子 Agent", "按钮不嵌在会话行的按钮里，能用键盘选到，读屏说明点了会展开");
  const list = document.getElementById(button!.getAttribute("aria-controls")!);
  check(list?.hidden && !list.querySelector(".agent-subagent"), "收起时子 Agent 列表不显示");

  const below = items()[1];
  const belowTop = below.getBoundingClientRect().top;
  await act(async () => { button!.click(); });
  check(toggle()?.getAttribute("aria-expanded") === "true" && toggle()?.getAttribute("aria-label") === "收起 2 个子 Agent", "点按钮展开，按钮标成已展开");
  const rows = [...document.querySelectorAll<HTMLLIElement>(".agent-subagent")];
  check(rows.length === 2 && !document.getElementById(toggle()!.getAttribute("aria-controls")!)?.hidden, "展开后列出两个子 Agent");
  check(rows[0].querySelector(".agent-subagent__title")?.textContent === "摸底其余国内编程代理"
    && rows[0].querySelector(".agent-subagent__tool-name")?.textContent === "WebSearch"
    && rows[0].querySelector(".agent-subagent__tag")?.textContent === "后台"
    && rows[0].querySelector(".agent-subagent__time")?.textContent?.startsWith("2 分"), `每个子 Agent 一行：描述、后台标记、当前工具、用时：${rows[0].textContent}`);
  check(rows[1].querySelector(".agent-subagent__thinking")?.textContent === "思考中" && !rows[1].querySelector(".agent-subagent__tag"), "没在调用工具的子 Agent 写思考中");
  const firstBox = first.querySelector(".agent-session__title")!.getBoundingClientRect();
  const rowBox = rows[0].getBoundingClientRect();
  check(rowBox.left > firstBox.left - 1 && rowBox.top > first.querySelector(".agent-session")!.getBoundingClientRect().bottom - 8, "子 Agent 缩进在父行标题下面");
  check(below.getAnimations().some((animation) => animation.playState === "running") && Math.abs(below.getBoundingClientRect().top - belowTop) < 4,
    `展开的一刻下面的会话留在原处，带着动画往下平移，而不是跳过去：${belowTop} → ${below.getBoundingClientRect().top}`);
  await settle(300);
  check(below.getBoundingClientRect().top > belowTop + 30 && getComputedStyle(below).transform === "none", `动画结束后下面的会话停在让出的位置：${belowTop} → ${below.getBoundingClientRect().top}`);
  check(!rows.some((row) => row.hasAttribute("data-session-key")), "子 Agent 行不算会话行，列表动效不单独移动它们");
  const panel = document.querySelector<HTMLElement>(".agent-sessions")!;
  check(panel.scrollWidth <= panel.clientWidth && rows[1].scrollWidth <= rows[1].clientWidth + 1, "子 Agent 行不撑出横向滚动");

  await render(withAgents(sampleSubagents(now).slice(0, 1)));
  check(document.querySelectorAll(".agent-subagent").length === 1 && toggle()?.textContent === "1 个子 Agent", "跑完的子 Agent 自动从列表里消失");
  await render(withAgents([]));
  check(!toggle() && first.isConnected && items()[0].querySelector(".agent-session__meta")?.textContent?.includes("2 个子 Agent"), "子 Agent 都跑完后按钮消失，只剩原来的数量");
  await render(withAgents(sampleSubagents(now)));
  check(toggle()?.getAttribute("aria-expanded") === "false", "之后再有子 Agent 时仍默认收起");
  await act(async () => { toggle()!.click(); });
  await act(async () => { toggle()!.click(); });
  check(toggle()?.getAttribute("aria-expanded") === "false" && !document.querySelector(".agent-subagent"), "再点一下收起");

  await settle(250);
  await render(sessions);
}
