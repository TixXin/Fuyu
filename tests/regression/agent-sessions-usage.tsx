import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { I18nProvider } from "../../src/i18n";
import { AgentSessionsPanel } from "../../src/features/agent-status/AgentSessionsPanel";
import type { AgentSessionSummary } from "../../src/features/agent-status/api";
import { getAgentPageExpandedHeight } from "../../src/features/agent-status/islandLayout";
import { DEFAULT_USAGE_VIEW, type UsageView } from "../../src/features/agent-status/usage";
import { checkUsageLayouts } from "./agent-usage-layouts";
import { SessionLightStyleContext } from "../../src/features/agent-status/SessionLightMark";
import { JellyfishStyleContext } from "../../src/components/jellyfish/jellyfishStyleContext";

type Context = { root: Root; fixture: HTMLElement; sessions: AgentSessionSummary[]; check: (condition: unknown, label: string) => void; chromeHeight: number };

export async function checkUsage({ root, fixture, sessions, check, chromeHeight }: Context) {
  const table: UsageView = { ...DEFAULT_USAGE_VIEW, layout: "table" };
  const ISLAND_CHROME_HEIGHT = chromeHeight;
  check(!document.querySelector(".agent-usage"), "没打开用量时不显示用量行");
  fixture.style.height = `${getAgentPageExpandedHeight(3, true) - ISLAND_CHROME_HEIGHT}px`;
  await act(async () => {
    root.render(<StrictMode><I18nProvider><AgentSessionsPanel sort="recent" sessions={sessions} hostDisplay="both" showUsage usageView={table} /></I18nProvider></StrictMode>);
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  const usage = document.querySelector<HTMLElement>(".agent-usage");
  const values = [...document.querySelectorAll<HTMLElement>(".agent-usage__value")];
  check(usage?.textContent?.includes("5 小时27%") && usage.textContent.includes("7 天62%") && usage.textContent.includes("Fable100%"), "顶部显示 5 小时、7 天和各模型的用量");
  check(values.map((value) => value.className.replace("agent-usage__value agent-usage__value--", "")).join() === "low,medium,high", "用量按多少分绿、橙、红");
  const reset = usage?.querySelector<HTMLElement>(".agent-usage__reset");
  check(reset?.textContent === "1天10小时" && reset.getAttribute("aria-label") === "1 天 10 小时后重置" && reset.querySelector("svg"), `用重置图标加短时间写最紧的那个窗口何时重置：${reset?.textContent}`);
  check(getComputedStyle(usage!).fontSize === "13px" && !usage!.querySelector(".agent-usage__stale"), "用量和会话第二行一样 13px，没过时不显示时钟");
  const usageList = document.querySelector<HTMLElement>(".agent-sessions__list")!;
  check(usageList.clientHeight > 0, "加上用量行后列表正常展示");
  check(usage!.getBoundingClientRect().width > usageList.getBoundingClientRect().width - 20, "悬停卡片的外壳不改变用量行的宽度");
  const line = usage!.getBoundingClientRect();
  const clear = (pointer: number) => {
    const box = document.querySelector<HTMLElement>(".island-hover-card")!.getBoundingClientRect();
    return box.right <= pointer - 8 || box.left >= pointer + 22;
  };
  let pointer = line.left + line.width / 2;
  await act(async () => { usage!.parentElement!.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, clientX: pointer, clientY: line.top + 10 })); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 260)); });
  const usageCard = document.querySelector<HTMLElement>(".island-hover-card");
  check(usageCard?.textContent?.includes("· 来自 claude-hud") && usageCard.getBoundingClientRect().top >= usage!.getBoundingClientRect().bottom
    && usageCard.getBoundingClientRect().top < usage!.getBoundingClientRect().bottom + 20, `悬停用量行时，行下方的卡片写出更新时间和来源：${usageCard?.textContent}`);
  check(clear(pointer), "卡片避开鼠标指针");
  pointer = line.left + 20;
  await act(async () => { usage!.parentElement!.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: pointer, clientY: line.top + 10 })); });
  check(clear(pointer), "鼠标沿着用量行移动时，卡片继续避开指针");
  await act(async () => { usage!.parentElement!.dispatchEvent(new PointerEvent("pointerout", { bubbles: true, relatedTarget: document.body })); });

  const readAt = Date.now();
  const usages = {
    claude: { updatedAt: readAt, plan: null, fiveHour: { name: "", used: 27, resetsAt: null }, sevenDay: null, models: [] },
    codex: { updatedAt: readAt, plan: "Plus", source: "codex" as const, fiveHour: { name: "", used: 9, resetsAt: null }, sevenDay: { name: "", used: 91, resetsAt: readAt + 2 * 86_400_000 }, models: [] },
    others: {},
    credits: {},
    readAt,
  };
  fixture.style.height = `${getAgentPageExpandedHeight(3, 2) - ISLAND_CHROME_HEIGHT}px`;
  await act(async () => {
    root.render(<StrictMode><I18nProvider><AgentSessionsPanel sort="recent" sessions={sessions} hostDisplay="both" showUsage usages={usages} usageView={table} /></I18nProvider></StrictMode>);
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  const lines = [...document.querySelectorAll<HTMLElement>(".agent-usage")];
  check(lines.length === 2 && lines[1].getAttribute("aria-label") === "Codex 用量" && lines[1].textContent?.includes("7 天91%"), "Codex 也报告额度时，Claude 下面多一行 Codex 用量");
  const cellLeft = (line: HTMLElement, index: number) => line.querySelectorAll<HTMLElement>(".agent-usage__window")[index]?.getBoundingClientRect().left;
  check(Math.abs(cellLeft(lines[0], 0) - cellLeft(lines[1], 0)) < 0.5 && lines[1].querySelectorAll(".agent-usage__window").length === 2, "两行用量的 5 小时一列对齐");
  const twoLineList = document.querySelector<HTMLElement>(".agent-sessions__list")!;
  check(twoLineList.clientHeight > 0, "两行用量时列表正常展示");
  await act(async () => {
    root.render(<StrictMode><I18nProvider><AgentSessionsPanel sort="recent" sessions={sessions} hostDisplay="both" showUsage usages={{ ...usages, claude: null }} usageView={table} /></I18nProvider></StrictMode>);
  });
  check(document.querySelectorAll(".agent-usage").length === 1 && document.querySelector(".agent-usage")?.getAttribute("aria-label") === "Codex 用量", "只有 Codex 有额度时只显示 Codex 一行");
  await act(async () => {
    root.render(<StrictMode><I18nProvider><AgentSessionsPanel sort="recent" sessions={sessions} hostDisplay="both" showUsage usages={{ ...usages, claude: { ...usages.claude, updatedAt: readAt - 40 * 60_000 } }} usageView={table} /></I18nProvider></StrictMode>);
  });
  const staleLines = [...document.querySelectorAll<HTMLElement>(".agent-usage")];
  const clock = staleLines[0].querySelector(".agent-usage__stale");
  check(clock?.querySelector("svg") && clock.getAttribute("aria-label") === "可能已过时：40 分钟前更新 · 来自 claude-hud" && !staleLines[0].textContent?.includes("可能已过时")
    && !staleLines[1].querySelector(".agent-usage__stale") && Math.abs(cellLeft(staleLines[0], 0) - cellLeft(staleLines[1], 0)) < 0.5,
    "过时的那一行行尾只放一个时钟图标，说明写在读屏文字和悬停卡片里，列照样对齐");

  const wide = {
    ...usages,
    others: { antigravity: { updatedAt: readAt, plan: null, fiveHour: null, sevenDay: null, models: [{ name: "Gemini 3 Pro", used: 30, resetsAt: null }] } },
    credits: { workbuddy: { provider: "workbuddy" as const, updatedAt: readAt, source: null, available: true, credits: { today: 1240, sevenDay: 8930, total: 20000, totalTokens: 0, sessions: 3 }, wallets: [], error: null } },
  };
  await act(async () => {
    root.render(<StrictMode><I18nProvider><AgentSessionsPanel sort="recent" sessions={sessions} hostDisplay="both" showUsage usages={wide} usageView={table} /></I18nProvider></StrictMode>);
  });
  const wideLines = [...document.querySelectorAll<HTMLElement>(".agent-usage")];
  check(wideLines.map((line) => line.getAttribute("aria-label")).join() === "Claude Code 用量,Codex 用量,Antigravity 用量,WorkBuddy 用量", `这台电脑上读得到额度的每家各占一行：${wideLines.map((line) => line.getAttribute("aria-label")).join()}`);
  check(wideLines[3].querySelector(".agent-usage__credit")?.textContent === "今日 1,240 · 7 天 8,930 积分" && !wideLines[3].querySelector(".agent-usage__value"), "WorkBuddy 没有百分比，写今日和 7 天的积分");
  await act(async () => {
    root.render(<StrictMode><I18nProvider><AgentSessionsPanel sort="recent" sessions={sessions} hostDisplay="both" showUsage usages={wide} usageView={{ ...table, agentsOff: ["antigravity"], hidden: ["workbuddy"] }} /></I18nProvider></StrictMode>);
  });
  check([...document.querySelectorAll(".agent-usage")].map((line) => line.getAttribute("aria-label")).join() === "Claude Code 用量,Codex 用量", "在「接入哪些 Agent」里关掉的和在额度里隐藏的都不占行");
  await checkUsageLayouts({ root, sessions, usages: wide, check });

  const host = document.createElement("div");
  fixture.after(host);
  const lights = createRoot(host);
  await act(async () => {
    lights.render(<StrictMode><I18nProvider><JellyfishStyleContext.Provider value="neon"><SessionLightStyleContext.Provider value="mark"><AgentSessionsPanel sort="recent" sessions={sessions} hostDisplay="both" /></SessionLightStyleContext.Provider></JellyfishStyleContext.Provider></I18nProvider></StrictMode>);
  });
  const jellies = [...host.querySelectorAll<HTMLElement>(".agent-session .agent-session__jelly .center-jelly")];
  check(jellies.length === sessions.length && !host.querySelector(".agent-session__dot") && jellies.every((jelly) => jelly.dataset.pixelStyle === "neon"),
    `状态灯设成水母时，列表每行的灯也换成水母，跟着像素样式：${jellies.length}`);
  check(jellies.map((jelly) => jelly.dataset.mood).join() === "running,waiting,idle", `水母表情跟着会话状态：${jellies.map((jelly) => jelly.dataset.mood).join()}`);
  await act(async () => {
    lights.render(<StrictMode><I18nProvider><SessionLightStyleContext.Provider value="mark"><AgentSessionsPanel sort="recent" sessions={[{ ...sessions[0], sessionId: "light-compact", compacting: true }, { ...sessions[0], sessionId: "light-stale", phase: "stale" }]} hostDisplay="both" /></SessionLightStyleContext.Provider></I18nProvider></StrictMode>);
  });
  const moods = [...host.querySelectorAll<HTMLElement>(".agent-session__jelly .center-jelly")].map((jelly) => jelly.dataset.mood).join();
  check(moods === "compacting,stale", `压缩上下文和可能中断各有自己的水母表情，不再借用失败：${moods}`);
  host.style.cssText = "position: fixed; left: 0; top: -2000px; width: 400px";
  await act(async () => {
    lights.render(<StrictMode><I18nProvider><SessionLightStyleContext.Provider value="mark"><AgentSessionsPanel sort="recent" sessions={sessions} hostDisplay="both" /></SessionLightStyleContext.Provider></I18nProvider></StrictMode>);
  });
  const paused = () => [...host.querySelectorAll<HTMLElement>(".agent-session__jelly .center-jelly")].map((jelly) => jelly.dataset.paused === "true");
  const settle = async (want: boolean) => {
    for (let i = 0; i < 40 && !paused().every((value) => value === want); i++) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
    return paused();
  };
  check((await settle(true)).every(Boolean), "看不见的行（滚出去、岛收起）里的水母停下，不白占 CPU");
  host.style.top = "0";
  check((await settle(false)).every((value) => !value), "回到视野里的水母接着动");
  for (const view of ["split", "bento", "projects", "minimal"] as const) {
    await act(async () => {
      lights.render(<StrictMode><I18nProvider><SessionLightStyleContext.Provider value="mark"><AgentSessionsPanel sort="recent" view={view} sessions={sessions} hostDisplay="both" /></SessionLightStyleContext.Provider></I18nProvider></StrictMode>);
    });
    const viewMoods = [...host.querySelectorAll<HTMLElement>(".agent-session__jelly .center-jelly")].map((jelly) => jelly.dataset.mood).join();
    check(viewMoods.split(",").length === sessions.length, `${view} 视图也显示水母状态灯：${viewMoods}`);
  }
  act(() => lights.unmount());
  host.remove();
}
