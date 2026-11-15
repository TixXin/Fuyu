import { act, StrictMode } from "react";
import type { Root } from "react-dom/client";
import { I18nProvider } from "../../src/i18n";
import { AgentSessionsPanel } from "../../src/features/agent-status/AgentSessionsPanel";
import type { AgentSessionSummary } from "../../src/features/agent-status/api";
import { getAgentPageExpandedHeight } from "../../src/windows/island/layout";

type Context = { root: Root; fixture: HTMLElement; sessions: AgentSessionSummary[]; chromeHeight: number };

const TOOL = { name: "Bash", detail: "cd /Users/tixxin/Desktop/projects/Fuyu && node scripts/run-regression.mjs agent-sessions" };

function showcaseSessions(sessions: AgentSessionSummary[]): AgentSessionSummary[] {
  return [
    { ...sessions[0], lastPrompt: "把 Agent 页的右侧胶囊和用量行排一下", currentTool: TOOL, permissionMode: "auto" },
    { ...sessions[1], lastPrompt: "恢复发布机环境" },
    sessions[2],
  ];
}

function usages(now: number) {
  return {
    claude: { updatedAt: now, plan: null, fiveHour: { name: "", used: 27, resetsAt: now + 3 * 3_600_000 }, sevenDay: { name: "", used: 62, resetsAt: now + 5 * 86_400_000 }, models: [{ name: "Fable", used: 91, resetsAt: now + 34 * 60_000 }] },
    codex: { updatedAt: now - 40 * 60_000, plan: "Plus", source: "codex" as const, fiveHour: { name: "", used: 9, resetsAt: null }, sevenDay: { name: "", used: 54, resetsAt: now + 2 * 86_400_000 }, models: [] },
    readAt: now,
  };
}

export async function checkNarrow({ root, fixture, sessions, chromeHeight }: Context, check: (condition: unknown, label: string) => void) {
  fixture.style.width = "360px";
  fixture.style.height = `${getAgentPageExpandedHeight(3) - chromeHeight}px`;
  await act(async () => {
    root.render(<StrictMode><I18nProvider><AgentSessionsPanel sort="recent" sessions={showcaseSessions(sessions)} hostDisplay="both" showActivity /></I18nProvider></StrictMode>);
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  const rows = [...document.querySelectorAll<HTMLElement>(".agent-session")];
  const inside = rows.every((row) => {
    const heading = row.querySelector(".agent-session__heading")!.getBoundingClientRect();
    return [...row.querySelector(".agent-session__heading")!.children].every((child) => child.getBoundingClientRect().right <= heading.right + 0.5);
  });
  const times = rows.flatMap((row) => [...row.querySelectorAll<HTMLElement>(".agent-session__time")]);
  const titles = rows.map((row) => row.querySelector<HTMLElement>(".agent-session__title")!.clientWidth);
  const effort = rows[0].querySelector<HTMLElement>(".agent-session__pill-effort");
  check(inside && times.length >= 2 && times.every((time) => time.scrollWidth <= time.clientWidth) && titles.every((width) => width >= 28), "400 宽（弹出提醒）时标题行不溢出，时间不被截，标题留得下几个字");
  check(effort && getComputedStyle(effort).display === "none" && rows[0].querySelector(".agent-session__pill-mode"), "放不下时胶囊先省掉推理强度，权限还在");
  const tail = rows[0].querySelector<HTMLElement>(".agent-session__tool-tail");
  check(tail?.textContent === "/run-regression.mjs agent-sessions" && tail.getBoundingClientRect().right <= rows[0].getBoundingClientRect().right, "工具参数太长时省略中间，路径的尾部留在行内");
  fixture.style.width = "";
}

export async function renderShowcase({ root, fixture, sessions, chromeHeight }: Context) {
  const params = new URLSearchParams(location.search);
  const narrow = params.has("narrow");
  if (params.has("light")) {
    document.documentElement.classList.add("island-light");
    document.body.style.background = "#f2f2f5";
    fixture.style.setProperty("--island-ink-rgb", "24, 24, 30");
  }
  fixture.style.width = narrow ? "360px" : "";
  fixture.style.height = `${getAgentPageExpandedHeight(3, narrow ? 0 : 2) - chromeHeight}px`;
  const removal = narrow ? undefined : { remove: () => undefined, removed: null, undo: () => undefined };
  await act(async () => {
    root.render(<StrictMode><I18nProvider><AgentSessionsPanel sort="recent" sessions={showcaseSessions(sessions)} hostDisplay="both" showActivity showUsage={!narrow} usages={usages(Date.now())} removal={removal} /></I18nProvider></StrictMode>);
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}
