import { act, StrictMode } from "react";
import type { Root } from "react-dom/client";
import { I18nProvider } from "../../src/i18n";
import { AgentSessionsPanel } from "../../src/features/agent-status/AgentSessionsPanel";
import type { AgentSessionSummary } from "../../src/features/agent-status/api";
import { getAgentPageExpandedHeight } from "../../src/windows/island/layout";

type Context = { root: Root; fixture: HTMLElement; sessions: AgentSessionSummary[]; check: (condition: unknown, label: string) => void; chromeHeight: number };

export async function checkUsage({ root, fixture, sessions, check, chromeHeight }: Context) {
  const ISLAND_CHROME_HEIGHT = chromeHeight;
  check(!document.querySelector(".agent-usage"), "没打开用量时不显示用量行");
  fixture.style.height = `${getAgentPageExpandedHeight(3, true) - ISLAND_CHROME_HEIGHT}px`;
  await act(async () => {
    root.render(<StrictMode><I18nProvider><AgentSessionsPanel sort="recent" sessions={sessions} hostDisplay="both" showUsage /></I18nProvider></StrictMode>);
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
  check(usageList.scrollHeight <= usageList.clientHeight + 1, "加上用量行后，设为 3 条时仍放下 3 个会话");
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
    readAt,
  };
  fixture.style.height = `${getAgentPageExpandedHeight(3, 2) - ISLAND_CHROME_HEIGHT}px`;
  await act(async () => {
    root.render(<StrictMode><I18nProvider><AgentSessionsPanel sort="recent" sessions={sessions} hostDisplay="both" showUsage usages={usages} /></I18nProvider></StrictMode>);
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  const lines = [...document.querySelectorAll<HTMLElement>(".agent-usage")];
  check(lines.length === 2 && lines[1].getAttribute("aria-label") === "Codex 用量" && lines[1].textContent?.includes("7 天91%"), "Codex 也报告额度时，Claude 下面多一行 Codex 用量");
  const cellLeft = (line: HTMLElement, index: number) => line.querySelectorAll<HTMLElement>(".agent-usage__window")[index]?.getBoundingClientRect().left;
  check(Math.abs(cellLeft(lines[0], 0) - cellLeft(lines[1], 0)) < 0.5 && lines[1].querySelectorAll(".agent-usage__window").length === 2, "两行用量的 5 小时一列对齐");
  const twoLineList = document.querySelector<HTMLElement>(".agent-sessions__list")!;
  check(twoLineList.scrollHeight <= twoLineList.clientHeight + 1, "两行用量时，设为 3 条仍放下 3 个会话");
  await act(async () => {
    root.render(<StrictMode><I18nProvider><AgentSessionsPanel sort="recent" sessions={sessions} hostDisplay="both" showUsage usages={{ ...usages, claude: null }} /></I18nProvider></StrictMode>);
  });
  check(document.querySelectorAll(".agent-usage").length === 1 && document.querySelector(".agent-usage")?.getAttribute("aria-label") === "Codex 用量", "只有 Codex 有额度时只显示 Codex 一行");
  await act(async () => {
    root.render(<StrictMode><I18nProvider><AgentSessionsPanel sort="recent" sessions={sessions} hostDisplay="both" showUsage usages={{ ...usages, claude: { ...usages.claude, updatedAt: readAt - 40 * 60_000 } }} /></I18nProvider></StrictMode>);
  });
  const staleLines = [...document.querySelectorAll<HTMLElement>(".agent-usage")];
  const clock = staleLines[0].querySelector(".agent-usage__stale");
  check(clock?.querySelector("svg") && clock.getAttribute("aria-label") === "可能已过时：40 分钟前更新" && !staleLines[0].textContent?.includes("可能已过时")
    && !staleLines[1].querySelector(".agent-usage__stale") && Math.abs(cellLeft(staleLines[0], 0) - cellLeft(staleLines[1], 0)) < 0.5,
    "过时的那一行行尾只放一个时钟图标，说明写在读屏文字和悬停卡片里，列照样对齐");
}
