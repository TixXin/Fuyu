import { act, StrictMode, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import "../../src/windows/island/IslandApp";
import "../../src/windows/island/topEdge";
import { IslandShell } from "../../src/windows/island/IslandShell";
import type { PluginNotificationsController } from "../../src/features/plugins/usePluginNotifications";
import { useQQNotifications } from "../../src/features/messages/qq-notifications/QQNotifications";
import { useWeChatReminders } from "../../src/features/messages/wechat/WeChatReminders";
import { useMail } from "../../src/features/messages/mail/MailPanel";
import { useFixtureLines } from "./islandLines";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });
const automated = new URLSearchParams(location.search).has("test");
const NO_PLUGIN_NOTIFICATIONS: PluginNotificationsController = { notification: null, dismiss: () => {}, runAction: () => {}, post: () => {} };
mockIPC((command) => {
  if (command === "list_plugin_views") return { views: [], status: [] };
  if (command === "get_qq_mail_state") return [];
}, { shouldMockEvents: true });

type State = { expanded: boolean };
let change: (next: Partial<State>) => void;

function Fixture() {
  const [state, setState] = useState<State>({ expanded: false });
  change = (next) => setState((current) => ({ ...current, ...next }));
  const qq = useQQNotifications(true);
  const wechat = useWeChatReminders(true);
  const qqMail = useMail(true);
  useFixtureLines({ messages: { qq: qq, wechat: wechat, mail: qqMail, plugin: NO_PLUGIN_NOTIFICATIONS, preview: null }, agents: 0, status: { state: "idle", label: "AI Agent 空闲或已完成" }, todoTitle: "写周报和整理会议记录" });
  return <div className="stage" style={{ "--collapsed-island-width": "340px", "--island-scale": 1, "--island-collapsed-scale": 1, "--island-expanded-scale": 1, "--expanded-island-width": "560px", "--expanded-island-height": "306px", "--island-top-fillet-size": 8 } as CSSProperties}>
    <IslandShell
      mode={state.expanded ? "expanded" : "collapsed"} page="todo" isTucked={false} isDetached showTitle={false}
      showCollapsedText appearanceMode="classic" nativeGlassState="disabled"
      features={{ todo: true, music: true, clipboard: true, shelf: true, qq: true, wechat: true, qqMail: true, agents: true, translation: true, calendar: true, screenshots: true } as never}
      onOpenPage={() => {}}
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
const stage = () => document.querySelector<HTMLElement>(".stage")!;
const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
const near = (a: number, b: number) => Math.abs(a - b) < 1;
const dockTo = (edge: "top" | "bottom") => {
  document.documentElement.dataset.islandEdge = edge;
  document.documentElement.dataset.islandTopEdge = edge === "top" ? "attached" : "detached";
};
const set = (next: Partial<State>) => act(async () => { change(next); });
async function settleTransitions() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 900)); });
}
const results = document.getElementById("results")!;

async function runChecks() {
  try {
    dockTo("bottom");
    await settleTransitions();
    const shell = island().getBoundingClientRect();
    check(near(shell.bottom, stage().getBoundingClientRect().bottom), "收起的岛贴在舞台底部");
    check(near(shell.height, 38), "收起的岛还是 38 高的横向胶囊");
    const style = getComputedStyle(island());
    check(parseFloat(style.borderBottomLeftRadius) === 0 && parseFloat(style.borderBottomRightRadius) === 0, "贴底一侧是直边");
    check(parseFloat(style.borderTopLeftRadius) > 0 && parseFloat(style.borderTopRightRadius) > 0, "上方两角是圆角");
    const fillet = getComputedStyle(island(), "::before");
    check(fillet.opacity === "1" && fillet.transform.startsWith("matrix(1, 0, 0, -1"), "两个下角画反向圆弧（贴顶圆角翻到下面）");
    check(near(box(".island__collapsed").bottom, shell.bottom), "收起层贴着岛的下沿");

    await set({ expanded: true });
    await settleTransitions();
    const panel = island().getBoundingClientRect();
    check(near(panel.bottom, stage().getBoundingClientRect().bottom) && near(panel.height, 306), "面板往上展开，下沿不动");
    check(near(box(".island__expanded").bottom, panel.bottom) && near(box(".island__expanded").top, panel.top), "展开层贴着岛的下沿，填满面板");
    check(box(".island__header").top >= panel.top - 0.5, "标签栏在面板顶部，不出岛");
    const hint = getComputedStyle(document.querySelector(".island-resize-hint--bottom")!);
    check(hint.maskPosition.endsWith("0%") || hint.maskPosition.endsWith("top"), "Alt 改尺寸的提示线在上边");
    const label = document.querySelector<HTMLElement>(".island-resize-size");
    check(!label, "没在拖动时不显示尺寸");

    dockTo("top");
    await settleTransitions();
    check(near(island().getBoundingClientRect().top, stage().getBoundingClientRect().top), "换回顶边时面板从顶部往下展开");
    check(getComputedStyle(document.querySelector(".island-resize-hint--bottom")!).maskPosition.split(" ").pop() !== "0%", "顶边时提示线回到下边");
    await set({ expanded: false });
    await settleTransitions();
    check(parseFloat(getComputedStyle(island()).borderTopLeftRadius) === 0 && parseFloat(getComputedStyle(island()).borderBottomLeftRadius) > 0, "顶边的造型不变：上直下圆");

    results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
    results.dataset.result = "passed";
  } catch (error) {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
    console.error(error);
  }
}

dockTo("bottom");
await act(async () => { createRoot(document.getElementById("fixture")!).render(<StrictMode><Fixture /></StrictMode>); });
if (automated) await runChecks();
else {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: false });
  results.textContent = "演示：贴在屏幕底边的岛。加 ?test=1 运行检查。";
}
