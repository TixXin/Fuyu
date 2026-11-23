import { act, StrictMode, type ReactNode } from "react";
import type { Root } from "react-dom/client";
import { I18nProvider } from "../../src/i18n";
import { AgentSessionsPanel } from "../../src/features/agent-status/AgentSessionsPanel";
import type { AgentSettingValues } from "../../src/features/agent-status/agentSettings";
import type { AgentSessionSummary } from "../../src/features/agent-status/api";
import { DEFAULT_USAGE_VIEW, type AgentUsages, type UsageView } from "../../src/features/agent-status/usage";

type Context = { root: Root; sessions: AgentSessionSummary[]; usages: AgentUsages; check: (condition: unknown, label: string) => void };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const labels = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)].map((node) => node.getAttribute("aria-label"));

export async function checkUsageLayouts({ root, sessions, usages, check }: Context) {
  const show = async (node: ReactNode) => {
    await act(async () => {
      root.render(<StrictMode><I18nProvider>{node}</I18nProvider></StrictMode>);
      await wait(30);
    });
  };
  const panel = (view: Partial<UsageView>, onChange?: (patch: Partial<AgentSettingValues>) => void) => (
    <AgentSessionsPanel sort="recent" sessions={sessions} hostDisplay="both" showUsage usages={usages} usageView={{ ...DEFAULT_USAGE_VIEW, ...view, onChange }} />
  );

  await show(panel({}));
  const chips = labels(".agent-usage-chip");
  check(document.querySelector(".agent-usage-box")?.getAttribute("data-layout") === "chips" && !document.querySelector(".agent-usage-table"), "默认布局是一行胶囊，不再是表格");
  check(chips.join() === "Claude Code 用量 5 小时 27%,Codex 用量 7 天 91%,Antigravity 用量 Gemini 3 Pro 30%,WorkBuddy 用量 今日 1,240 · 7 天 8,930 积分", `每家一颗胶囊，只写最紧的那项，积分写数和单位：${chips}`);
  const chipRows = new Set([...document.querySelectorAll<HTMLElement>(".agent-usage-chip")].map((chip) => Math.round(chip.getBoundingClientRect().top)));
  check(chipRows.size === 1, `四家的胶囊在一行里放得下：${chipRows.size} 行`);
  const workbuddy = [...document.querySelectorAll<HTMLElement>(".agent-usage-chip")][3];
  check(workbuddy.querySelector(".agent-usage-chip__money")?.textContent === "8,930" && workbuddy.querySelector(".agent-usage-chip__label")?.textContent === "积分 · 7 天", "WorkBuddy 胶囊写 7 天的积分和单位");

  await show(panel({ style: "ring" }));
  check(document.querySelectorAll(".agent-usage-chip .mini-ring").length === 3, "胶囊跟着额度样式：圆环样式每颗百分比胶囊带一个环");

  await show(panel({ layout: "tiles", reset: "off" }));
  const tiles = [...document.querySelectorAll<HTMLElement>(".agent-usage-tile")];
  check(tiles.length === 4 && tiles[1].querySelector(".agent-usage-tile__big")?.textContent === "91%7 天" && tiles[1].querySelector(".agent-usage-tile__sub")?.textContent === "+1", `小方块：大数字写最紧的，关掉重置时间后只写还有几项：${tiles[1]?.textContent}`);

  await show(panel({ layout: "lead" }));
  const lead = document.querySelector<HTMLElement>(".agent-usage-lead__main");
  check(lead?.getAttribute("aria-label") === "Codex 用量 7 天 91%" && lead.textContent?.includes("最紧 · Codex 7 天"), `最紧的领头：所有家里用得最多的那项单独一行：${lead?.textContent}`);
  check(labels(".agent-usage-lead__item").join() === "Claude Code 用量 5 小时 27%,Antigravity 用量 Gemini 3 Pro 30%,WorkBuddy 用量 今日 1,240 · 7 天 8,930 积分", "其余几家排在第二行");
  const toggle = document.querySelector<HTMLButtonElement>(".agent-usage-lead__toggle")!;
  await act(async () => { toggle.click(); await wait(20); });
  check(toggle.getAttribute("aria-expanded") === "true" && document.querySelectorAll(".agent-usage-lead__all .agent-usage").length === 4 && toggle.textContent === "收起", "点「全部额度」展开成表格，按钮变成收起");

  await show(panel({ layout: "ruler" }));
  const pins = [...document.querySelectorAll<HTMLElement>(".agent-usage-ruler__pin")];
  const spots = pins.map((pin) => Number.parseFloat(pin.style.left));
  check(pins.length === 3 && spots[0] === 27 && spots[1] === 91 && spots[2] === 40, `水位刻度：每家一枚标记，挨得近的错开：${spots}`);
  check(document.querySelectorAll(".agent-usage-ruler__cash .agent-usage-chip").length === 1, "没有百分比的积分放在刻度下面");

  const expiredUsages = { ...usages, claude: usages.claude && { ...usages.claude, updatedAt: usages.readAt - 10 * 86_400_000, fiveHour: { name: "", used: 29, resetsAt: usages.readAt - 9 * 86_400_000 }, sevenDay: null, models: [] } };
  await show(<AgentSessionsPanel sort="recent" sessions={sessions} hostDisplay="both" showUsage usages={expiredUsages} usageView={DEFAULT_USAGE_VIEW} />);
  const expired = document.querySelector<HTMLElement>(".agent-usage-chip--expired");
  check(expired?.getAttribute("aria-label") === "Claude Code 用量 已过期 · 10 天前" && !labels(".agent-usage-chips .agent-usage-chip").some((label) => label?.startsWith("Claude Code")),
    `Claude 的额度全都过了重置时间时不消失，变成一颗灰的「已过期」：${expired?.getAttribute("aria-label")}`);
  const fix = document.querySelector<HTMLButtonElement>(".agent-usage-expired .agent-usage-fix");
  check(fix?.textContent === "修复" && expired?.closest(".island-hover-card__anchor")?.nextElementSibling === fix, `Claude 过期的胶囊旁边有「修复」，点了直接重装钩子：${fix?.textContent}`);

  const patches: Partial<AgentSettingValues>[] = [];
  await show(panel({ layout: "tiles" }, (patch) => patches.push(patch)));
  await act(async () => {
    document.querySelector(".agent-usage-box")!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    await wait(20);
  });
  const items = [...document.querySelectorAll<HTMLButtonElement>(".row-menu [role=menuitem]")].map((item) => item.textContent);
  check(items.slice(0, 5).join() === "一行胶囊,小方块,最紧的领头,水位刻度,表格" && items.includes("重置时间") && !items.includes("只看最紧的一项"), `右键菜单先换布局，只列这个布局用得上的选项：${items}`);
  await act(async () => { document.querySelectorAll<HTMLButtonElement>(".row-menu [role=menuitem]")[3].click(); });
  check(JSON.stringify(patches[patches.length - 1]) === JSON.stringify({ agentUsageLayout: "ruler" }), "在菜单里点水位刻度改布局设置");
  await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
}
