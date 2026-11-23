import { act, StrictMode, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { I18nProvider } from "../../src/i18n";
import { AgentSessionsPanel } from "../../src/features/agent-status/AgentSessionsPanel";
import { AgentEmptyState } from "../../src/features/agent-status/AgentEmptyState";
import type { AgentEmptyStyle, AgentSettingValues } from "../../src/features/agent-status/agentSettings";
import type { AgentSessionSummary } from "../../src/features/agent-status/api";
import { DEFAULT_USAGE_VIEW, type AgentUsages, type UsageView } from "../../src/features/agent-status/usage";

type Context = { root: Root; sessions: AgentSessionSummary[]; check: (condition: unknown, label: string) => void };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function checkUsageViewAndEmpty({ root, sessions, check }: Context) {
  const readAt = Date.now();
  const usages = {
    claude: { updatedAt: readAt, plan: null, fiveHour: { name: "", used: 27, resetsAt: readAt + 3 * 3_600_000 }, sevenDay: { name: "", used: 62, resetsAt: readAt + 5 * 86_400_000 }, models: [{ name: "Fable", used: 100, resetsAt: readAt + 86_400_000 }] },
    codex: { updatedAt: readAt, plan: "Plus", source: "codex" as const, fiveHour: { name: "", used: 9, resetsAt: null }, sevenDay: { name: "", used: 16, resetsAt: readAt + 2 * 86_400_000 }, models: [] },
    others: {},
    credits: {},
    readAt,
  };
  const show = async (node: ReactNode) => {
    await act(async () => {
      root.render(<StrictMode><I18nProvider>{node}</I18nProvider></StrictMode>);
      await wait(30);
    });
  };
  const panel = (view: Partial<UsageView>, onChange?: (patch: Partial<AgentSettingValues>) => void) => (
    <AgentSessionsPanel sort="recent" sessions={sessions} hostDisplay="both" showUsage usages={usages} usageView={{ ...DEFAULT_USAGE_VIEW, ...view, onChange }} />
  );
  const windows = (index: number) => [...document.querySelectorAll<HTMLElement>(".agent-usage")[index]?.querySelectorAll(".agent-usage__label") ?? []].map((label) => label.textContent);

  await show(panel({ hidden: ["codex", "models"] }));
  check(document.querySelectorAll(".agent-usage").length === 1 && windows(0).join() === "5 小时,7 天", `隐藏 Codex 和其他额度后只剩 Claude 的 5 小时、7 天：${windows(0)}`);
  await show(panel({ tightest: true }));
  check(windows(0).join() === "Fable" && windows(1).join() === "7 天", `只看最紧的：每家只留用得最多的一项：${windows(0)} / ${windows(1)}`);
  const cellLefts = [0, 1].map((index) => document.querySelectorAll<HTMLElement>(".agent-usage")[index].querySelector<HTMLElement>(".agent-usage__window")!.getBoundingClientRect().left);
  check(Math.abs(cellLefts[0] - cellLefts[1]) < 0.5, "只看最紧的时两家那一项在同一列，不按窗口种类错开");
  await show(panel({ reset: "off", style: "ring" }));
  check(!document.querySelector(".agent-usage__reset") && document.querySelectorAll(".agent-usage .mini-ring").length === 5, "重置时间关掉后不显示，圆环样式每项一个环");
  await show(panel({ reset: "each", style: "bar" }));
  check(document.querySelectorAll(".agent-usage__bar").length === 5 && document.querySelectorAll(".agent-usage__window-reset").length === 4, "进度条样式每项一条，每项都写重置时间（没有重置时间的那项不写）");

  const patches: Partial<AgentSettingValues>[] = [];
  await show(panel({}, (patch) => patches.push(patch)));
  const menuButton = document.querySelector<HTMLButtonElement>(".agent-usage__menu-button");
  check(menuButton?.getAttribute("aria-label") === "调整额度显示", "额度行带一个调整显示的菜单按钮");
  await act(async () => {
    document.querySelector(".agent-usage-box")!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    await wait(20);
  });
  const items = [...document.querySelectorAll<HTMLButtonElement>(".row-menu [role=menuitem]")];
  check(items.map((item) => item.textContent).join() === "Claude Code,Codex,5 小时,7 天,其他额度,只看最紧的一项,重置时间", `右键额度行弹出菜单：${items.map((item) => item.textContent)}`);
  await act(async () => { items[1].click(); });
  check(JSON.stringify(patches[patches.length - 1]) === JSON.stringify({ agentUsageHidden: ["codex"] }) && document.querySelector(".row-menu"), "勾掉 Codex 改设置，菜单不关");
  await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
  await show(panel({}));
  await checkEmptyStates({ usages, sessions, check });
}

async function checkEmptyStates({ usages, sessions, check }: { usages: AgentUsages; sessions: AgentSessionSummary[]; check: Context["check"] }) {
  const host = document.createElement("div");
  host.className = document.querySelector(".agent-sessions")?.parentElement?.className ?? "";
  host.style.cssText = "position:absolute;left:0;top:0;width:760px;height:260px;display:flex;flex-direction:column";
  document.body.append(host);
  const root = createRoot(host);
  const show = async (node: ReactNode) => {
    await act(async () => {
      root.render(<StrictMode><I18nProvider>{node}</I18nProvider></StrictMode>);
      await wait(30);
    });
  };

  const empty = (style: AgentEmptyStyle, extra: Partial<Parameters<typeof AgentEmptyState>[0]> = {}) => (
    <AgentSessionsPanel sort="recent" sessions={[]} hostDisplay="both" showUsage usages={usages}
      empty={<AgentEmptyState style={style} sessions={[]} sessionHours={24} showUsage usages={usages} usageView={DEFAULT_USAGE_VIEW} {...extra} />} />
  );
  await show(empty("sleep"));
  check(host.querySelector(".agent-empty--sleep .center-jelly[data-mood='sleep']") && host.querySelector(".agent-empty")?.textContent?.includes("都歇着呢") && host.querySelector(".agent-usage"), "默认空状态是打盹的水母，上面照样有额度行");
  await show(empty("quota"));
  check(host.querySelectorAll(".agent-quota-gauge").length === 5 && !host.querySelector(".agent-usage"), "额度当主角：每项一个大圆环，顶上不再重复额度行");
  await show(empty("quota", { showUsage: false }));
  check(host.querySelector(".agent-empty--sleep"), "关掉额度时，额度当主角退回成打盹的水母");
  await show(empty("standby"));
  await act(async () => { await wait(30); });
  const names = [...host.querySelectorAll(".agent-standby__name")].map((name) => name.textContent);
  check(names.join() === "Claude Code,Codex,去接入" && host.querySelector(".agent-standby")?.textContent?.includes("钩子需要更新"), `待命台先列 Claude Code、Codex，再加一张去接入：${names}`);

  const ended = sessions.map((session) => ({ ...session, phase: "completed" as const }));
  const settingsPatches: Partial<AgentSettingValues>[] = [];
  await show(empty("recent", { sessions: ended, sessionHours: 6, onSettingsChange: (patch) => settingsPatches.push(patch) }));
  const buttons = [...host.querySelectorAll<HTMLButtonElement>(".agent-empty__button")];
  check(host.querySelector(".agent-recent") && buttons.map((button) => button.textContent).join() === `显示已结束的 ${ended.length} 个,看 24 小时内`, `上一段：灰着显示最后一个会话和两个按钮：${buttons.map((button) => button.textContent)}`);
  await act(async () => { buttons[0].click(); buttons[1].click(); });
  check(JSON.stringify(settingsPatches) === JSON.stringify([{ agentHideFinished: false, agentHideClosed: false }, { agentSessionHours: 24 }]), "两个按钮分别打开已结束的会话和放宽到 24 小时");
  await show(empty("tide"));
  check(host.querySelector(".agent-tide") && host.querySelector(".agent-empty--tide")?.textContent?.includes("今天的潮汐"), "今日潮汐画出当天的波浪");
  await show(empty("minimal"));
  check(host.querySelector(".agent-empty--minimal")?.textContent === "风平浪静，没有 Agent 在跑", "极简水平线只有一行字");
  await act(async () => root.unmount());
  host.remove();
}
