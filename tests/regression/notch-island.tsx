import { act, StrictMode, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import "../../src/windows/island/IslandApp";
import { IslandShell } from "../../src/windows/island/IslandShell";
import { applyIslandNotch, notchExpandedExtra, notchFittedWidth } from "../../src/windows/island/notch";
import type { IslandNotch } from "../../src/windows/island/api";
import type { PluginNotificationsController } from "../../src/features/plugins/usePluginNotifications";
import { useQQNotifications } from "../../src/features/messages/qq-notifications/QQNotifications";
import { useWeChatReminders } from "../../src/features/messages/wechat/WeChatReminders";
import { useMail } from "../../src/features/messages/mail/MailPanel";
import type { MediaState } from "../../src/features/media/api";

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

type State = { notch: IslandNotch | null; tucked: boolean };
let change: (next: Partial<State>) => void;

function Fixture() {
  const [state, setState] = useState<State>({ notch: NOTCH, tucked: false });
  change = (next) => setState((current) => ({ ...current, ...next }));
  const qq = useQQNotifications(true);
  const wechat = useWeChatReminders(true);
  const qqMail = useMail(true);
  const width = notchFittedWidth(300, state.notch, 1);
  return <div className="stage" style={{ "--collapsed-island-width": `${width}px`, "--island-scale": 1, "--island-collapsed-scale": 1 } as CSSProperties}>
    <IslandShell deviceUse={{ camera: [], microphone: [] }} qqNotifications={qq} wechatReminders={wechat} qqMail={qqMail} pluginNotifications={NO_PLUGIN_NOTIFICATIONS} preview={null}
      mode="collapsed" page="todo" isTucked={state.tucked} isDetached={false} showTitle={false}
      showCollapsedText={true} collapsedTaskTitle="写周报和整理会议记录" collapsedTodoCount={null} agentSession={null} activeAgentSessionCount={0}
      lyricLine={null} appearanceMode="classic" nativeGlassState="disabled" agentVisualState="idle" agentStatusLabel="AI Agent 空闲或已完成"
      mediaState={UNAVAILABLE_MEDIA}
      features={{ todo: true, music: false, clipboard: true, shelf: true, qq: false, wechat: false, qqMail: false, agents: false, translation: false }}
      shelfCount={null}
      onOpenPage={() => {}} onOpenMessages={() => {}}
      onPageChange={() => {}} onWindowDragStart={() => {}} onCollapse={() => {}}
      onResetPosition={() => {}} minimizesToTray onMinimize={() => {}} onOpenSettings={() => {}} onOpenTranslator={() => {}} translationPeek={null} onOpenTranslationPeek={() => {}} onTuck={() => {}} onReveal={() => {}} pageDigitModifiers="Alt" hoverSwitchPage={false} hoverSwitchDelayMs={0}>
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
    const text = bar().querySelector(".island__active-task")!;
    check(box(text).left >= hole.right - 0.5, "待办文字在刘海右边，不被刘海挡住");
    check(bar().querySelector(".island__notch-wing--left .island__pulse"), "状态灯在刘海左边");
    check(bar().scrollWidth <= bar().clientWidth + 1, "两翼的内容不撑出收起条");
    check(notchFittedWidth(280, NOTCH, 1) === NOTCH.width + 112 && notchFittedWidth(300, NOTCH, 1) === NOTCH.width + 152 && notchFittedWidth(520, NOTCH, 1) === NOTCH.width + 200,
      "两翼没有文字时每侧 56，按内容加宽，最多 100，岛不会比原来宽太多");
    const expanded = document.querySelector<HTMLElement>(".island__expanded")!;
    check(parseFloat(getComputedStyle(expanded).paddingTop) === NOTCH.height + 8, "展开和弹出的内容从刘海下面开始，不被刘海挡住");
    check(notchExpandedExtra(NOTCH, 1, false) === NOTCH.height + 8 - 18 && notchExpandedExtra(NOTCH, 1, true) === NOTCH.height && notchExpandedExtra(null, 1, true) === 0,
      "展开的岛按让出的高度加高，内容区不变小");

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
