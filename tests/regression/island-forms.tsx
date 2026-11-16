import { act, StrictMode, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import "../../src/windows/island/IslandApp";
import { IslandShell } from "../../src/windows/island/IslandShell";
import { applyIslandNotch, notchExpandedExtra, notchFittedWidth, notchPanelWidth } from "../../src/windows/island/notch";
import { islandFormLayout, PILL_TOP_GAP } from "../../src/windows/island/islandForm";
import type { IslandForm } from "../../src/lib/settings/types";
import type { IslandNotch } from "../../src/windows/island/api";
import type { PluginNotificationsController } from "../../src/features/plugins/usePluginNotifications";
import { useQQNotifications } from "../../src/features/messages/qq-notifications/QQNotifications";
import { useWeChatReminders } from "../../src/features/messages/wechat/WeChatReminders";
import { useMail } from "../../src/features/messages/mail/MailPanel";
import { useFixtureLines } from "./islandLines";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });
const automated = new URLSearchParams(location.search).has("test");
const NO_PLUGIN_NOTIFICATIONS: PluginNotificationsController = { notification: null, dismiss: () => {}, runAction: () => {}, post: () => {} };
const SIMULATED: IslandNotch = { width: 72, height: 32, simulated: true };
const REAL: IslandNotch = { width: 200, height: 32 };
mockIPC((command) => {
  if (command === "list_plugin_views") return { views: [], status: [] };
  if (command === "get_qq_mail_state") return [];
}, { shouldMockEvents: true });

type State = { form: IslandForm; notch: IslandNotch | null; tucked: boolean; expanded: boolean; popup: boolean; light: boolean };
let change: (next: Partial<State>) => void;

function Fixture() {
  const [state, setState] = useState<State>({ form: "top", notch: null, tucked: false, expanded: false, popup: false, light: false });
  change = (next) => setState((current) => ({ ...current, ...next }));
  const qq = useQQNotifications(true);
  const wechat = useWeChatReminders(true);
  const qqMail = useMail(true);
  const width = notchFittedWidth(300, state.notch, 1);
  return <div className={state.light ? "stage island-light" : "stage"} style={{ "--collapsed-island-width": `${width}px`, "--island-scale": 1, "--island-collapsed-scale": 1, "--island-expanded-scale": 1, "--expanded-island-width": `${state.popup ? notchPanelWidth(400, state.notch, 1, true) : notchPanelWidth(560, state.notch, 1, false)}px`, "--expanded-island-height": "306px" } as CSSProperties}>
    <IslandShell lineSources={useFixtureLines({ barText: !state.notch, todoTitle: "写周报和整理会议记录" })} qqNotifications={qq} wechatReminders={wechat} qqMail={qqMail} pluginNotifications={NO_PLUGIN_NOTIFICATIONS} preview={null}
      mode={state.expanded ? "expanded" : "collapsed"} page={state.popup ? "agents" : "todo"} popup={state.popup} isTucked={state.tucked} isDetached={islandFormLayout({ islandForm: state.form, marginY: 0, menuBarPlacement: "notch" }).marginY > 0} showTitle={false}
      showCollapsedText={!state.notch} activeAgentSessionCount={0}
      appearanceMode="classic" nativeGlassState="disabled" agentVisualState="idle" agentStatusLabel="AI Agent 空闲或已完成"
      features={{ todo: true, music: true, clipboard: true, shelf: true, qq: true, wechat: true, qqMail: true, agents: true, translation: true, calendar: true, screenshots: true } as never}
      shelfCount={null}
      onOpenPage={() => {}} onOpenMessages={() => {}}
      onPageChange={() => {}} onWindowDragStart={() => {}} onCollapse={() => {}}
      onResetPosition={() => {}} minimizesToTray onMinimize={() => {}} onOpenSettings={() => {}} onOpenTranslator={() => {}} onTuck={() => {}} onReveal={() => {}} pageDigitModifiers="Alt" hoverSwitchPage={false} hoverSwitchDelayMs={0}>
      <span>待办清单</span>
    </IslandShell>
  </div>;
}

const messages: string[] = [];
function check(condition: unknown, label: string) {
  if (!condition) throw new Error(label);
  messages.push(`PASS ${label}`);
}
const island = () => document.querySelector<HTMLElement>(".island")!;
const bar = () => document.querySelector<HTMLElement>(".island__collapsed")!;
const surface = () => document.querySelector<HTMLElement>(".island__surface")!;
const box = (element: Element) => element.getBoundingClientRect();
const radius = (corner: "borderTopLeftRadius" | "borderBottomLeftRadius") => parseFloat(getComputedStyle(island())[corner]);
const set = (next: Partial<State>) => act(async () => {
  if (next.notch !== undefined) applyIslandNotch(next.notch);
  if (next.form) document.documentElement.dataset.islandForm = next.form;
  change(next);
});
async function settleTransitions() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 900)); });
}
const results = document.getElementById("results")!;

async function runChecks() {
  try {
    const layout = (islandForm: IslandForm, marginY = 0, menuBarPlacement: "notch" | "below" = "notch") => islandFormLayout({ islandForm, marginY, menuBarPlacement });
    check(layout("top").marginY === 0 && !layout("top").fitNotch && !layout("top").underMenuBar && layout("top", 0, "below").underMenuBar, "贴顶：离顶照「顶部距离」，菜单栏照设置");
    check(layout("pill").marginY === PILL_TOP_GAP && layout("pill", 30).marginY === 30 && layout("pill").underMenuBar && !layout("pill").fitNotch, "药丸：离顶至少 10，Mac 上从菜单栏下沿算");
    check(layout("notch", 40, "below").marginY === 0 && layout("notch", 40, "below").fitNotch && !layout("notch", 0, "below").underMenuBar, "刘海：贴住顶边、压在菜单栏上");

    await set({ form: "top" });
    await settleTransitions();
    check(Math.abs(box(island()).height - 38) < 1 && radius("borderTopLeftRadius") === 0, "贴顶：高 38，上角是直的（贴住顶边）");
    check(getComputedStyle(surface()).boxShadow === "none", "贴顶没有投影");

    await set({ form: "pill" });
    await settleTransitions();
    check(radius("borderTopLeftRadius") > 0 && Math.abs(radius("borderTopLeftRadius") - radius("borderBottomLeftRadius")) < 0.5, "药丸：四个角一样圆");
    check(getComputedStyle(surface()).boxShadow.includes("0.35"), "药丸：深色岛下面有 35% 的投影");
    await set({ light: true });
    await settleTransitions();
    check(getComputedStyle(surface()).boxShadow.includes("0.18"), "药丸：浅色岛的投影淡一些（18%）");
    await set({ light: false, tucked: true });
    await settleTransitions();
    check(getComputedStyle(surface()).boxShadow === "none", "药丸收起到顶边时不画投影");
    await set({ tucked: false, expanded: true });
    await settleTransitions();
    check(getComputedStyle(surface()).boxShadow.includes("0.35") && radius("borderTopLeftRadius") > 0, "药丸展开后仍是悬空的圆角面板，带投影");
    await set({ expanded: false });

    await set({ form: "notch", notch: SIMULATED });
    await settleTransitions();
    check(document.documentElement.dataset.islandNotch === "simulated", "没有真刘海时画模拟刘海");
    check(notchFittedWidth(280, SIMULATED, 1) === 240 && notchFittedWidth(300, SIMULATED, 1) === 240, "模拟刘海宽 240");
    check(Math.abs(box(island()).width - 240) < 1 && Math.abs(box(island()).height - 32) < 1, "模拟刘海 240×32");
    check(getComputedStyle(island()).backgroundColor === "rgb(0, 0, 0)" && Math.abs(radius("borderBottomLeftRadius") - 14) < 0.5, "模拟刘海纯黑，下角 14");
    const gap = bar().querySelector<HTMLElement>(".island__notch-gap");
    check(gap && Math.abs(box(gap).width - 72) < 1 && Math.abs(box(gap).left + box(gap).width / 2 - (box(island()).left + box(island()).width / 2)) < 1, "中间空出约 30%（72px），正好在正中");
    check(bar().querySelector(".island__notch-wing--left .island__pulse"), "Agent 灯在左翼");
    check(bar().scrollWidth <= bar().clientWidth + 1, "两翼的内容不撑出刘海");
    check(notchExpandedExtra(SIMULATED, 1, true) === 0 && notchPanelWidth(560, SIMULATED, 1, false) === 560, "模拟刘海展开时不加高、不加宽");
    await set({ light: true });
    await settleTransitions();
    check(getComputedStyle(island()).backgroundColor === "rgb(0, 0, 0)", "浅色岛折叠成刘海时也是纯黑");
    await set({ expanded: true });
    await settleTransitions();
    const header = document.querySelector<HTMLElement>(".island__header")!;
    check(getComputedStyle(header).display !== "grid" || !getComputedStyle(header).gridTemplateColumns.includes("88px"), "模拟刘海展开后标签栏不让出中间");
    check(!getComputedStyle(island()).backgroundImage.includes("linear-gradient"), "浅色岛展开后跟主题，顶部不变黑");
    await set({ light: false });
    await settleTransitions();
    check(getComputedStyle(island()).backgroundImage.includes("linear-gradient"), "深色岛展开后顶部从纯黑过渡");
    await set({ popup: true });
    await settleTransitions();
    const band = document.querySelector<HTMLElement>(".island__notch-band");
    check(!band || getComputedStyle(band).display === "none", "模拟刘海弹出卡片时不画真刘海那条标题带");
    await set({ popup: false, expanded: false, tucked: true });
    await settleTransitions();
    check(Math.abs(box(island()).width - 240) < 1 && Math.abs(box(island()).height - 32) < 1, "模拟刘海贴边收起时同宽（窗口上滑露 6px，由原生端移动）");

    await set({ notch: REAL, tucked: true });
    await settleTransitions();
    check(document.documentElement.dataset.islandNotch === "on" && Math.abs(box(island()).width - (REAL.width - 4)) < 1, "真刘海收起照旧缩进刘海里");

    await set({ form: "top", notch: null, tucked: false });
    await settleTransitions();
    check(!bar().querySelector(".island__notch-gap") && Math.abs(box(island()).height - 38) < 1, "切回贴顶后收起条照旧");

    results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
    results.dataset.result = "passed";
  } catch (error) {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
    console.error(error);
  }
}

await act(async () => { createRoot(document.getElementById("fixture")!).render(<StrictMode><Fixture /></StrictMode>); });
if (automated) await runChecks();
else {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: false });
  results.textContent = "演示：贴顶 / 药丸 / 刘海三种形态。加 ?test=1 运行检查。";
}
