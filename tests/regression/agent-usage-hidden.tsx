import { act, StrictMode, useState } from "react";
import type { Root } from "react-dom/client";
import { I18nProvider } from "../../src/i18n";
import { AgentSessionsPanel } from "../../src/features/agent-status/AgentSessionsPanel";
import type { AgentSessionSummary } from "../../src/features/agent-status/api";
import type { UsageViewChange } from "../../src/features/agent-status/AgentUsageMenu";
import { DEFAULT_USAGE_VIEW, type AgentUsages, type UsageView } from "../../src/features/agent-status/usage";

type Context = { root: Root; sessions: AgentSessionSummary[]; usages: AgentUsages; check: (condition: unknown, label: string) => void };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function Panel({ sessions, usages, start }: { sessions: AgentSessionSummary[]; usages: AgentUsages; start: Partial<UsageView> }) {
  const [view, setView] = useState<UsageView>({ ...DEFAULT_USAGE_VIEW, ...start });
  const onChange: UsageViewChange = (patch) => setView((current) => ({
    ...current,
    hidden: patch.agentUsageHidden ?? current.hidden,
    tightest: patch.agentUsageTightest ?? current.tightest,
    reset: patch.agentUsageReset ?? current.reset,
    layout: patch.agentUsageLayout ?? current.layout,
  }));
  return <AgentSessionsPanel sort="recent" sessions={sessions} hostDisplay="both" showUsage usages={usages} usageView={{ ...view, onChange }} />;
}

export async function checkUsageAllHidden({ root, sessions, usages, check }: Context) {
  const show = async (start: Partial<UsageView>) => {
    await act(async () => {
      root.render(<StrictMode><I18nProvider><Panel sessions={sessions} usages={usages} start={start} /></I18nProvider></StrictMode>);
      await wait(30);
    });
  };
  const pick = async (label: string) => {
    await act(async () => { document.querySelector<HTMLButtonElement>(".agent-usage__menu-button")?.click(); await wait(30); });
    const item = [...document.querySelectorAll<HTMLButtonElement>(".row-menu [role='menuitem']")].find((entry) => entry.textContent === label);
    await act(async () => { item?.click(); await wait(30); });
    return Boolean(item && !item.disabled);
  };
  const hiddenBox = () => document.querySelector<HTMLElement>(".agent-usage-box--hidden");

  await show({ hidden: ["fiveHour", "sevenDay"] });
  const box = hiddenBox();
  const menu = box?.querySelector<HTMLElement>(".agent-usage__menu");
  check(box?.textContent === "额度都被隐藏了，点右边的按钮重新选" && !document.querySelector(".agent-usage") && menu && getComputedStyle(menu).opacity === "1",
    `窗口只留各模型、哪家都没有分模型额度时，用量条不消失，写一行提示并露出调整按钮：${box?.textContent}`);
  const note = box?.querySelector<HTMLElement>(".agent-usage__all-hidden");
  const words = document.createRange();
  if (note) words.selectNodeContents(note);
  check(note && note.scrollWidth <= note.clientWidth + 1 && words.getBoundingClientRect().right <= menu!.getBoundingClientRect().left + 1, `提示文字不压住调整按钮、不溢出：${words.getBoundingClientRect().right} / ${menu?.getBoundingClientRect().left}`);
  const picked = await pick("5 小时");
  check(picked && !hiddenBox() && document.querySelectorAll(".agent-usage-chip").length > 0, "从调整菜单把 5 小时勾回来，用量重新显示");

  const codexOnly: AgentUsages = { ...usages, claude: null, others: {}, credits: {} };
  await act(async () => {
    root.render(<StrictMode><I18nProvider><Panel key="codex-only" sessions={sessions} usages={codexOnly} start={{ hidden: ["codex"] }} /></I18nProvider></StrictMode>);
    await wait(30);
  });
  check(hiddenBox(), "只读得到一家、这一家又被隐藏时，同样留着提示和按钮");
  check(await pick("Codex") && !hiddenBox() && document.querySelector(".agent-usage-chip")?.getAttribute("aria-label")?.startsWith("Codex"), "只有一家时菜单里也给出这一家的开关，勾回来就显示");
}
