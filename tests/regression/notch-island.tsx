import { act, StrictMode, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import "../../src/windows/island/IslandApp";
import { IslandShell } from "../../src/windows/island/IslandShell";
import { applyIslandNotch, notchExpandedExtra, notchFittedWidth, notchPanelWidth } from "../../src/windows/island/notch";
import type { IslandNotch } from "../../src/windows/island/api";
import type { PluginNotificationsController } from "../../src/features/plugins/usePluginNotifications";
import { useQQNotifications } from "../../src/features/messages/qq-notifications/QQNotifications";
import { useWeChatReminders } from "../../src/features/messages/wechat/WeChatReminders";
import { useMail } from "../../src/features/messages/mail/MailPanel";
import type { MediaState } from "../../src/features/media/api";
import type { LevelChange } from "../../src/features/system-levels/api";
import type { DeviceAlert } from "../../src/features/device-events/api";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });
const automated = new URLSearchParams(location.search).has("test");
const NO_PLUGIN_NOTIFICATIONS: PluginNotificationsController = { notification: null, dismiss: () => {}, runAction: () => {}, post: () => {} };
const UNAVAILABLE_MEDIA: MediaState = {
  available: false, audioActive: false, audioPeak: 0, playbackStatus: "unavailable",
  title: null, artist: null, album: null, thumbnail: null, positionMs: 0, durationMs: 0,
  canSeek: false, canNext: false, canPrevious: false, shuffleActive: null, canShuffle: false,
  repeatMode: "unknown", canRepeat: false, volume: -1, sourceApp: null, activeSessionId: null,
  sessions: [], updatedAt: 0,
};
const NOTCH: IslandNotch = { width: 200, height: 32 };
mockIPC((command) => {
  if (command === "list_plugin_views") return { views: [], status: [] };
  if (command === "get_qq_mail_state") return [];
}, { shouldMockEvents: true });

type State = { notch: IslandNotch | null; tucked: boolean; peek: string | null; expanded: boolean; level: LevelChange | null; device: DeviceAlert | null };
let change: (next: Partial<State>) => void;

function Fixture() {
  const [state, setState] = useState<State>({ notch: NOTCH, tucked: false, peek: null, expanded: false, level: null, device: null });
  change = (next) => setState((current) => ({ ...current, ...next }));
  const qq = useQQNotifications(true);
  const wechat = useWeChatReminders(true);
  const qqMail = useMail(true);
  const width = notchFittedWidth(300, state.notch, 1, Boolean(state.level || state.device));
  return <div className="stage" style={{ "--collapsed-island-width": `${width}px`, "--island-scale": 1, "--island-collapsed-scale": 1, "--island-expanded-scale": 1, "--expanded-island-width": `${notchPanelWidth(560, state.notch, 1, false)}px`, "--expanded-island-height": "306px" } as CSSProperties}>
    <IslandShell deviceUse={{ camera: [], microphone: [] }} qqNotifications={qq} wechatReminders={wechat} qqMail={qqMail} pluginNotifications={NO_PLUGIN_NOTIFICATIONS} preview={null}
      mode={state.expanded ? "expanded" : "collapsed"} page="todo" isTucked={state.tucked} isDetached={false} showTitle={false}
      showCollapsedText={!state.notch} collapsedTaskTitle="写周报和整理会议记录" collapsedTodoCount={null} agentSession={null} activeAgentSessionCount={0}
      lyricLine={null} appearanceMode="classic" nativeGlassState="disabled" agentVisualState="idle" agentStatusLabel="AI Agent 空闲或已完成"
      mediaState={UNAVAILABLE_MEDIA}
      features={{ todo: true, music: true, clipboard: true, shelf: true, qq: true, wechat: true, qqMail: true, agents: true, translation: true, calendar: true, screenshots: true } as never}
      shelfCount={null}
      onOpenPage={() => {}} onOpenMessages={() => {}}
      onPageChange={() => {}} onWindowDragStart={() => {}} onCollapse={() => {}}
      onResetPosition={() => {}} minimizesToTray onMinimize={() => {}} onOpenSettings={() => {}} onOpenTranslator={() => {}} translationPeek={state.peek} levelPopup={state.level} deviceAlert={state.device} onOpenTranslationPeek={() => {}} onTuck={() => {}} onReveal={() => {}} pageDigitModifiers="Alt" hoverSwitchPage={false} hoverSwitchDelayMs={0}>
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
const box = (element: Element) => element.getBoundingClientRect();
const set = (next: Partial<State>) => act(async () => {
  if (next.notch !== undefined) applyIslandNotch(next.notch);
  change(next);
});
async function settleTransitions() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 900)); });
}
const results = document.getElementById("results")!;

async function runChecks() {
  try {
    await set({ notch: NOTCH });
    await settleTransitions();
    const gap = bar().querySelector<HTMLElement>(".island__notch-gap");
    check(gap, "贴合刘海时收起条中间有刘海空位");
    const shell = box(island());
    const hole = box(gap!);
    check(Math.abs(hole.left + hole.width / 2 - (shell.left + shell.width / 2)) < 1, "刘海空位正好在岛的正中");
    check(Math.abs(hole.width - NOTCH.width) < 1, "空位和刘海一样宽");
    check(Math.abs(shell.height - NOTCH.height) < 1, "岛的高度等于刘海高");
    check(getComputedStyle(island()).backgroundColor === "rgb(0, 0, 0)", "收起的岛是纯黑的");
    check(!bar().querySelector(".island__active-task, .island__notch-drop"), "平时贴合刘海的岛只放图标，不放待办文字");
    check(bar().querySelector(".island__notch-wing--left .island__pulse"), "状态灯在刘海左边");
    check(bar().scrollWidth <= bar().clientWidth + 1, "两翼的内容不撑出收起条");
    check(notchFittedWidth(280, NOTCH, 1) === NOTCH.width + 112 && notchFittedWidth(300, NOTCH, 1) === NOTCH.width + 152 && notchFittedWidth(520, NOTCH, 1) === NOTCH.width + 200,
      "两翼没有文字时每侧 56，按内容加宽，最多 100，岛不会比原来宽太多");
    check(notchExpandedExtra(NOTCH, 1, true) === NOTCH.height && notchExpandedExtra(NOTCH, 1, false) === 0 && notchExpandedExtra(null, 1, true) === 0,
      "弹出卡片按刘海加高；展开页的标签栏放进刘海两边，不用加高");
    await set({ expanded: true });
    await settleTransitions();
    const header = document.querySelector<HTMLElement>(".island__header")!;
    const start = box(document.querySelector(".island__header-start")!);
    const actions = box(document.querySelector(".window-actions")!);
    const notchLeft = box(island()).left + (box(island()).width - NOTCH.width) / 2;
    check(Math.abs(box(header).top - box(island()).top) < 1 && Math.abs(box(header).height - NOTCH.height) < 1, "展开页的标签栏和刘海在同一条上，一样高");
    check(start.right <= notchLeft + 0.5 && actions.left >= notchLeft + NOTCH.width - 0.5, "页面图标在刘海左边，按钮在刘海右边，都不压到刘海");
    check(header.scrollWidth <= header.clientWidth + 1 && start.left >= box(island()).left && actions.right <= box(island()).right, "所有页面都开着时也放得下");
    await set({ expanded: false });
    await settleTransitions();

    await set({ peek: "notch 刘海" });
    await settleTransitions();
    const drop = bar().querySelector<HTMLElement>(".island__notch-drop");
    check(drop && drop.textContent?.includes("notch 刘海"), "有提示时往下多长出一行，提示放在这一行里");
    check(box(drop!).top >= box(island()).top + NOTCH.height - 0.5 && Math.abs(box(island()).height - (NOTCH.height + 38)) < 1, "这一行在刘海下面，岛加高一行");
    check(box(drop!).bottom <= box(island()).bottom + 0.5, "提示不出岛");
    await set({ peek: null });
    await settleTransitions();
    check(!bar().querySelector(".island__notch-drop") && Math.abs(box(island()).height - NOTCH.height) < 1, "提示结束后岛缩回刘海高");

    await set({ level: { kind: "volume", level: 0.45, muted: false } });
    await settleTransitions();
    const leftWing = bar().querySelector(".island__notch-wing--left")!;
    const rightWing = bar().querySelector(".island__notch-wing--right")!;
    check(leftWing.querySelector(".notch-alert__icon .level-popup__icon") && !leftWing.querySelector(".island__pulse"), "音量提示：刘海左边换成喇叭图标");
    check(rightWing.querySelector(".level-popup__track") && rightWing.textContent?.includes("45"), "音量提示：刘海右边是进度条和数字");
    check(!bar().querySelector(".island__notch-drop") && Math.abs(box(island()).height - NOTCH.height) < 1, "短提示不往下长");
    check(box(rightWing.querySelector(".level-popup")!).right <= box(island()).right && box(leftWing).right <= box(island()).left + (box(island()).width - NOTCH.width) / 2 + 0.5, "两边的内容不出岛、不压刘海");
    await set({ level: null, device: { kind: "batteryLow", name: "AirPods Pro", battery: 10 } });
    await settleTransitions();
    check(bar().querySelector(".island__notch-wing--left .device-alert--warn") && bar().querySelector(".island__notch-wing--right")?.textContent?.trim() === "10%", "低电量：左边电池图标，右边 10%");
    check(bar().querySelector(".island__notch-wing--right [role=status]")?.getAttribute("aria-label")?.includes("AirPods Pro"), "读屏仍读完整的一句");
    await set({ device: null });
    await settleTransitions();
    check(bar().querySelector(".island__notch-wing--left .island__pulse"), "提示结束后刘海左边换回状态灯");

    await set({ tucked: true });
    await settleTransitions();
    check(Math.abs(box(island()).width - (NOTCH.width - 4)) < 1 && Math.abs(box(island()).height - NOTCH.height) < 1, "贴边收起时缩成比刘海略窄的黑块");
    check(getComputedStyle(island(), "::before").opacity === "0", "收进刘海时不画上缘两侧的弧");

    await set({ notch: null, tucked: false });
    await settleTransitions();
    check(!bar().querySelector(".island__notch-gap, .island__notch-wing"), "不贴合刘海时收起条照旧");
    check(Math.abs(box(island()).height - 38) < 1, "不贴合刘海时高度回到 38");

    results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
    results.dataset.result = "passed";
  } catch (error) {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
    console.error(error);
  }
}

applyIslandNotch(NOTCH);
await act(async () => { createRoot(document.getElementById("fixture")!).render(<StrictMode><Fixture /></StrictMode>); });
if (automated) await runChecks();
else {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: false });
  results.textContent = "演示：贴合刘海的收起岛（刘海 200×32）。加 ?test=1 运行检查。";
}
