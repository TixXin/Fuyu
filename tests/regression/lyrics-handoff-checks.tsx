import { act, StrictMode, useState, type CSSProperties } from "react";
import type { Root } from "react-dom/client";
import { I18nProvider } from "../../src/i18n";
import { IslandShell } from "../../src/windows/island/IslandShell";
import "../../src/windows/island/slots/builtins";
import type { MediaState } from "../../src/features/media/api";
import type { CurrentLyric } from "../../src/features/media/lyrics/useCurrentLyric";
import type { MessagePreview } from "../../src/features/messages/messagePreview";
import type { CollapsedMeeting } from "../../src/features/calendar/upcoming";
import type { AgentSessionSummary } from "../../src/features/agent-status/api";
import { useAgentInterjection } from "../../src/features/agent-status/useAgentInterjection";
import type { QQNotificationsController } from "../../src/features/messages/qq-notifications/QQNotifications";
import type { WeChatRemindersController } from "../../src/features/messages/wechat/WeChatReminders";
import type { MailController } from "../../src/features/messages/mail/MailPanel";
import type { PluginNotificationsController } from "../../src/features/plugins/usePluginNotifications";

type Check = (condition: unknown, label: string) => void;

const QQ = { snapshot: { items: [] }, openQQ: async () => true } as unknown as QQNotificationsController;
const WECHAT = { snapshot: { pending: false }, openWeChat: async () => true } as unknown as WeChatRemindersController;
const MAIL = { preview: null, previewAccount: null } as unknown as MailController;
const PLUGINS: PluginNotificationsController = { notification: null, dismiss: () => {}, runAction: () => {}, post: () => {} };
const LOOK = { fill: "smooth", lit: "#ffffff", dim: "#777777", glow: false, follow: false } as const;
const REMIND_MS = 6000;

let setPreview: (preview: MessagePreview | null) => void = () => {};
let setLyric: (lyric: CurrentLyric | null) => void = () => {};
let setMeeting: (meeting: CollapsedMeeting | null) => void = () => {};
let setSessions: (sessions: AgentSessionSummary[]) => void = () => {};

function Stage({ media }: { media: MediaState }) {
  const [preview, changePreview] = useState<MessagePreview | null>(null);
  const [lyric, changeLyric] = useState<CurrentLyric | null>(null);
  const [meeting, changeMeeting] = useState<CollapsedMeeting | null>(null);
  setPreview = changePreview; setLyric = changeLyric; setMeeting = changeMeeting;
  return <div className="stage" style={{ "--collapsed-island-width": "320px" } as CSSProperties}>
    <IslandShell deviceUse={{ camera: [], microphone: [] }} meeting={meeting} qqNotifications={QQ} wechatReminders={WECHAT} qqMail={MAIL} pluginNotifications={PLUGINS} preview={preview}
      mode="collapsed" page="todo" isTucked={false} isDetached showTitle={false} showCollapsedText collapsedTaskTitle="剩余3个待办" collapsedTodoCount={null}
      agentSession={null} lyricLine={lyric} activeAgentSessionCount={0} appearanceMode="classic" nativeGlassState="disabled" agentVisualState="idle" agentStatusLabel=""
      mediaState={media} features={{ todo: true, music: true, clipboard: false, shelf: false, qq: true, wechat: true, qqMail: true, agents: true, translation: false, calendar: false, screenshots: false, timer: false }}
      shelfCount={null} onOpenPage={() => {}} onOpenMessages={() => {}} onPageChange={() => {}} onWindowDragStart={() => {}} onCollapse={() => {}}
      onResetPosition={() => {}} minimizesToTray onMinimize={() => {}} onOpenSettings={() => {}} onOpenTranslator={() => {}} translationPeek={null} onOpenTranslationPeek={() => {}}
      onTuck={() => {}} onReveal={() => {}} pageDigitModifiers="Alt" hoverSwitchPage={false} hoverSwitchDelayMs={0}>
      <span>待办清单</span>
    </IslandShell>
  </div>;
}

function AgentProbe() {
  const [sessions, changeSessions] = useState<AgentSessionSummary[]>([]);
  setSessions = changeSessions;
  const shown = useAgentInterjection(sessions, true, REMIND_MS);
  return <span className="agent-probe">{shown?.title ?? ""}</span>;
}

const agent = (phase: AgentSessionSummary["phase"]) => ({
  provider: "claudeCode", sessionId: "a", cwd: null, title: "重构歌词", model: null, effort: null,
  phase, lastMessage: null, updatedAt: phase === "waiting" ? 2 : 1, host: null, turnStartedAt: null,
}) as unknown as AgentSessionSummary;

const pause = (ms: number) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });
const summary = () => document.querySelector<HTMLElement>(".island__summary")!;
const lyricRow = () => document.querySelector<HTMLElement>(".island__summary-layer:last-child .island__lyric");
const settled = () => summary().children.length === 1 && !summary().querySelector(".island__summary-layer--incoming");
const probe = () => document.querySelector<HTMLElement>(".agent-probe")!.textContent;

async function waitFor(condition: () => boolean, label: string, timeout = 2000) {
  const deadline = performance.now() + timeout;
  while (!condition()) {
    if (performance.now() > deadline) throw new Error(`等待超时：${label}`);
    await pause(16);
  }
}

export async function runLyricsHandoffChecks(root: Root, media: MediaState, check: Check) {
  await act(async () => {
    root.render(<StrictMode><I18nProvider><Stage media={media} /><AgentProbe /></I18nProvider></StrictMode>);
  });
  const sampledAt = Date.now();
  const words = [{ text: "Oh ", startMs: 1000, endMs: 1300 }, { text: "I ", startMs: 1300, endMs: 1700 }, { text: "believe", startMs: 1700, endMs: 6000 }];
  await act(async () => setLyric({ text: "Oh I believe", index: 0, longest: "Oh I believe", karaoke: { words, positionMs: 1000, sampledAt, clock: "c1", look: LOOK } }));
  check(lyricRow()?.textContent === "Oh I believe", "收起的岛显示逐字歌词");

  await act(async () => setPreview({ source: "qq", title: "小林", body: "下午一起开会吗？", receivedAt: Date.now() }));
  await waitFor(settled, "消息进入");
  check(!lyricRow() && summary().textContent?.includes("下午一起开会吗"), "消息打断歌词");
  await pause(1200);
  await act(async () => setPreview(null));
  check(getComputedStyle(lyricRow()!).animationDuration === "0s", "消息结束、歌词恢复时只走一次整体弹簧，不叠加换句动画");
  const believe = [...lyricRow()!.querySelectorAll<HTMLElement>(".karaoke__word")][2];
  const expected = 1700 - (1000 + (Date.now() - sampledAt));
  const delay = Number.parseFloat(believe.style.animationDelay);
  check(delay < 0 && Math.abs(delay - expected) < 250, `恢复后逐字高亮按真实时间接上（延迟 ${Math.round(delay)}ms，应为 ${Math.round(expected)}ms），不从句首重跑`);
  await waitFor(settled, "恢复完成");

  await act(async () => setLyric({ text: "in yesterday", index: 1, longest: "Oh I believe" }));
  const enter = getComputedStyle(lyricRow()!);
  check(enter.animationName === "taskFlowIn" && enter.animationDuration === "0.42s", "换句时新的一句轻量上移淡入");

  const startMs = Date.now() + 10 * 60_000;
  const event = { uid: "m1", title: "周会", startMs, endMs: startMs + 30 * 60_000, allDay: false, location: null, meetingLink: "https://meet.example.com/abc", calendar: "工作" };
  await act(async () => setMeeting({ upcoming: { event, minutes: 10 }, showTitle: true }));
  check(document.querySelector(".island-meeting")?.textContent?.includes("周会") && !lyricRow(), "会议提醒到点时先显示几秒会议");
  await act(async () => setSessions([agent("running")]));
  await act(async () => setSessions([agent("waiting")]));
  check(probe() === "重构歌词", "Agent 开始等你时插话");
  await pause(4300);
  check(probe() === "", "Agent 等你插话 4 秒后让回歌词，不再一直占住");
  await pause(4000);
  check(!document.querySelector(".island-meeting") && lyricRow()?.textContent === "in yesterday", "会议提醒几秒后回到歌词");
  check(document.querySelector(".island-meeting-join"), "回到歌词时加入会议按钮仍可点");
  check(probe() === "重构歌词", "到提醒时间还在等你，再插话一次");
  await waitFor(() => probe() === "", "再插话后让回", 6000);
  check(probe() === "", "再插话也是几秒后让回");
  await act(async () => setLyric(null));
  check(document.querySelector(".island-meeting"), "没在放歌词时会议提醒照常一直显示");
  await act(async () => setMeeting(null));
}
