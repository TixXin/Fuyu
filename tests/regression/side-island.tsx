import { act, StrictMode, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import { emit } from "@tauri-apps/api/event";
import "../../src/styles/tokens.css";
import "../../src/windows/island/IslandApp";
import "../../src/windows/island/topEdge";
import { IslandShell } from "../../src/windows/island/IslandShell";
import type { PluginNotificationsController } from "../../src/features/messages/island/usePluginNotifications";
import { useQQNotifications } from "../../src/features/messages/qq-notifications/QQNotifications";
import { useWeChatReminders } from "../../src/features/messages/wechat/WeChatReminders";
import { useMail } from "../../src/features/messages/mail/MailPanel";
import type { MediaState } from "../../src/features/media/api";
import type { MessagePreview } from "../../src/features/messages/messagePreview";
import type { LevelChange } from "../../src/features/system-levels/api";
import { useFixtureLines } from "./islandLines";

const FULL_DEVICES = { camera: ["会议"], microphone: [] };
const NO_DEVICES = { camera: [], microphone: [] };

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });
const automated = new URLSearchParams(location.search).has("test");
const NO_PLUGIN_NOTIFICATIONS: PluginNotificationsController = { notification: null, dismiss: () => {}, runAction: () => {}, post: () => {} };
const MEDIA: MediaState = {
  available: false, audioActive: false, audioPeak: 0, playbackStatus: "unavailable",
  title: null, artist: null, album: null, thumbnail: null, positionMs: 0, durationMs: 0,
  canSeek: false, canNext: false, canPrevious: false, shuffleActive: null, canShuffle: false,
  repeatMode: "unknown", canRepeat: false, volume: -1, sourceApp: null, activeSessionId: null,
  sessions: [], updatedAt: 0,
};
const PLAYING: MediaState = { ...MEDIA, available: true, playbackStatus: "playing", title: "晴天", thumbnail: "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==" };
const PREVIEW: MessagePreview = { source: "qq", title: "张三", body: "下午三点的会改到四点了，记得带上周报", receivedAt: 1 };
const reported: number[] = [];
const bubbleRects: unknown[] = [];
mockIPC((command, payload) => {
  if (command === "list_plugin_views") return { views: [], status: [] };
  if (command === "get_qq_mail_state") return [];
  if (command === "set_island_side_column") reported.push((payload as { height: number }).height);
  if (command === "set_island_side_bubble_rect") bubbleRects.push((payload as { rect: unknown }).rect);
}, { shouldMockEvents: true });

type State = {
  side: "left" | "right";
  expanded: boolean;
  tucked: boolean;
  full: boolean;
  gauges: number;
  cover: boolean;
  preview: MessagePreview | null;
  level: LevelChange | null;
};
let change: (next: Partial<State>) => void;

function Fixture() {
  const [state, setState] = useState<State>({ side: "left", expanded: false, tucked: false, full: false, gauges: 0, cover: false, preview: null, level: null });
  change = (next) => setState((current) => ({ ...current, ...next }));
  const qq = useQQNotifications(true);
  const wechat = useWeChatReminders(true);
  const qqMail = useMail(true);
  const gauges = Array.from({ length: state.gauges }, (_, index) => ({ id: `gauge-${index}`, node: <span className="gauge-dot">{index}</span> }));
  useFixtureLines({ messages: { qq: qq, wechat: wechat, mail: qqMail, plugin: NO_PLUGIN_NOTIFICATIONS, preview: state.preview }, agents: state.full ? 3 : 0, status: { state: state.full ? "running" : "idle", label: "AI Agent" }, todoCount: state.full ? 5 : null, levelPopup: state.level, deviceUse: state.full ? FULL_DEVICES : NO_DEVICES, media: state.full ? PLAYING : MEDIA, sideCover: state.cover, shelfCount: state.full ? 2 : null });
  return <div className="stage" style={{ "--collapsed-island-width": "340px", "--island-scale": 1, "--island-collapsed-scale": 1, "--island-expanded-scale": 1, "--expanded-island-width": "560px", "--expanded-island-height": "306px", "--island-top-fillet-size": 8 } as CSSProperties}>
    <IslandShell
      mode={state.expanded ? "expanded" : "collapsed"} page="todo" isTucked={state.tucked} isDetached side={state.side} showTitle={false}
      showCollapsedText appearanceMode="classic" nativeGlassState="disabled"
      collapsedSlots={{ gauges }}
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
const stageBox = () => document.querySelector<HTMLElement>(".stage")!.getBoundingClientRect();
const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
const near = (a: number, b: number) => Math.abs(a - b) < 1;
const items = () => [...document.querySelectorAll<HTMLElement>("[data-side-item]")].map((row) => row.dataset.sideItem);
const set = (next: Partial<State>) => act(async () => { change(next); });
async function settleTransitions() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 900)); });
}
const last = <T,>(list: T[]) => list[list.length - 1];
const results = document.getElementById("results")!;

async function runChecks() {
  try {
    await settleTransitions();
    let shell = island().getBoundingClientRect();
    check(near(shell.left, stageBox().left) && near(shell.top, stageBox().top), "左侧竖向岛贴着舞台左上");
    check(near(shell.width, 44) && near(shell.height, 48), "只有 Agent 时是 44×48 的竖向岛");
    check(last(reported) === 48, "把竖向岛高度报给原生");
    const style = getComputedStyle(island());
    check(parseFloat(style.borderTopLeftRadius) === 0 && parseFloat(style.borderBottomLeftRadius) === 0, "贴边一侧是直边");
    check(parseFloat(style.borderTopRightRadius) > 0 && parseFloat(style.borderBottomRightRadius) > 0, "朝屏幕内一侧是圆角");
    const fillet = getComputedStyle(island(), "::before");
    check(fillet.opacity === "1" && near(parseFloat(fillet.top), -8) && near(parseFloat(fillet.left), 0), "贴边角做反向圆弧（上方）");
    check(near(parseFloat(getComputedStyle(island(), "::after").top), 48), "贴边角做反向圆弧（下方）");
    check(getComputedStyle(document.querySelector(".island__side-handle")!).opacity === "0", "没收起时不显示把手");

    await set({ full: true });
    await settleTransitions();
    shell = island().getBoundingClientRect();
    check(items().join(",") === "agent,music,todo,device-camera,shelf", "图标从上到下按收起条的顺序排");
    check(near(shell.height, 184) && last(reported) === 184, "高度随内容长到 184");
    check(document.querySelector(".island-side-ring")!.textContent === "3", "Agent 环里写会话数");
    check(document.querySelector('[data-side-item="todo"] .island-side-cell__num')!.textContent === "5", "待办写数字");

    await set({ cover: true });
    check(document.querySelector('[data-side-item="music"] img'), "开了「音乐显示封面」时音乐那行是封面");
    await set({ cover: false, gauges: 8 });
    await settleTransitions();
    const more = document.querySelector<HTMLElement>(".island-side-more");
    check(more && /^\+\d+$/.test(more.textContent ?? ""), "放不下时最后一行是 +N");
    check(island().getBoundingClientRect().height <= 300, "竖向岛不超过 300 高");
    await set({ gauges: 0 });

    await set({ preview: PREVIEW });
    await settleTransitions();
    const bubble = box(".island-side-bubble");
    shell = island().getBoundingClientRect();
    check(near(bubble.left, shell.right), "消息气泡从岛的右边长出来");
    check(bubble.top >= shell.top && bubble.bottom <= shell.bottom, "气泡在岛的直边段内");
    check(document.querySelector(".island-side-bubble")!.textContent!.includes("记得带上周报"), "气泡里是消息内容");
    check(bubbleRects.some((rect) => rect !== null), "把气泡的点击区域报给原生");
    await set({ preview: null, level: { kind: "volume", level: 0.4, muted: false } });
    check(document.querySelector(".island-side-bubble"), "音量提示也走气泡");
    await set({ level: null });
    check(!document.querySelector(".island-side-bubble") && last(bubbleRects) === null, "提示结束气泡收回，点击区域清掉");

    await set({ tucked: true });
    await settleTransitions();
    shell = island().getBoundingClientRect();
    check(near(shell.width, 12) && near(shell.height, 72), "收起时缩成 12×72 的把手");
    check(getComputedStyle(document.querySelector(".island__side-handle")!).opacity === "1", "收起时显示把手");
    check(getComputedStyle(document.querySelector(".island-side-column")!).opacity === "0", "收起时竖向岛内容隐藏");
    await set({ tucked: false, expanded: true });
    await settleTransitions();
    shell = island().getBoundingClientRect();
    check(near(shell.left, stageBox().left) && near(shell.width, 560) && near(shell.height, 306), "展开成横版面板，贴着左边");
    check(getComputedStyle(document.querySelector(".island-side-column")!).opacity === "0", "展开时竖向岛内容隐藏");

    await set({ expanded: false, side: "right", preview: PREVIEW });
    await settleTransitions();
    shell = island().getBoundingClientRect();
    check(near(shell.right, stageBox().right), "右侧竖向岛贴着舞台右边");
    check(near(box(".island-side-bubble").right, shell.left), "右侧时气泡往左长出来");
    await set({ preview: null });

    await act(async () => { await emit("island-drag-edge-hint", { edge: "left", offset: 120 }); });
    const hint = box(".island-drag-hint--left");
    check(near(hint.left, 118.5) && hint.height > 100, "拖到侧边 16px 内时屏幕边上出现提示线");
    await act(async () => { await emit("island-drag-edge-hint", null); });
    check(!document.querySelector(".island-drag-hint"), "离开或松手时提示线消失");
    await settleTransitions();

    results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
    results.dataset.result = "passed";
  } catch (error) {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
    console.error(error);
  }
}

document.documentElement.dataset.islandEdge = "left";
document.documentElement.dataset.islandTopEdge = "detached";
await act(async () => { createRoot(document.getElementById("fixture")!).render(<StrictMode><Fixture /></StrictMode>); });
if (automated) await runChecks();
else {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: false });
  results.textContent = "演示：吸在屏幕左侧的竖向岛。加 ?test=1 运行检查。";
}
