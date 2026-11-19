import { act, StrictMode, useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles/tokens.css";
import "../../src/windows/island/IslandApp";
import { MessageArrivalsPanel } from "../../src/features/messages/arrivals/MessageArrivalsPanel";
import { useArrivalsHeading } from "../../src/features/messages/island/useArrivalsHeading";
import { useIslandMessagePanel } from "../../src/features/messages/island/useIslandMessagePanel";
import { useLatestMessagePreview } from "../../src/features/messages/island/useLatestMessagePreview";
import { usePluginNotifications } from "../../src/features/messages/island/usePluginNotifications";
import { deliverNotice } from "../../src/features/messages/plugin/notices";
import { updatePluginNames } from "../../src/features/plugin-kernel/pluginNames";
import { useIslandAction } from "../../src/features/plugin-kernel/useIslandContributions";
import type { IslandNotice } from "../../src/lib/island-notices/service";
import { setTrackArt, useTrackArt } from "../../src/lib/now-playing/trackArt";
import { islandHost } from "../../src/windows/island/islandHost";
import { NotchPopupBand } from "../../src/windows/island/NotchPopupBand";
import type { IslandMode, IslandPage } from "../../src/windows/island/types";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });
const automated = new URLSearchParams(location.search).has("test");

type Notices = Parameters<typeof useIslandMessagePanel>[0]["notices"];
const QUIET = { preview: null, previewReceivedAt: null, previewMessage: null, previewAccount: null, snapshot: { items: [] } };
const PANEL_MS = automated ? 3000 : 8000;
const TRACK_MS = automated ? 500 : 3000;
const COVER = "data:image/gif;base64,R0lGODlhAQABAIAAAP8AAP///yH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";
const LOGO = "data:image/gif;base64,R0lGODlhAQABAIAAAAAA/////yH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";
const NOTE = "data:image/gif;base64,R0lGODlhAQABAIAAAAD/AP///yH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";
const opened: string[] = [];
let state = { mode: "collapsed" as IslandMode, page: "todo" as IslandPage };
let setBlocked: (blocked: boolean) => void;
let collapse: () => void;
let setBand: (band: boolean) => void;

function Fixture() {
  const [mode, setMode] = useState<IslandMode>("collapsed");
  const [page, setPage] = useState<IslandPage>("todo");
  const [panelOpen, setPanelOpen] = useState(false);
  const [blocked, setBlockedState] = useState(false);
  const [band, setBandState] = useState(true);
  setBand = setBandState;
  state = { mode, page };
  setBlocked = setBlockedState;
  const plugins = usePluginNotifications(mode === "collapsed" || panelOpen, blocked);
  const chat = QUIET as unknown as Notices["qqNotifications"] & Notices["wechatReminders"] & Notices["qqMail"];
  const preview = useLatestMessagePreview(chat, chat, chat, plugins);
  const openIslandPage = useCallback((next: IslandPage) => { setPage(next); setMode("expanded"); }, []);
  const collapseIsland = useCallback(() => setMode("collapsed"), []);
  useIslandAction("media.open-page", () => { opened.push("music"); openIslandPage("music"); });
  const panel = useIslandMessagePanel({
    enabled: true, durationMs: PANEL_MS,
    notices: { preview, qqNotifications: chat, wechatReminders: chat, qqMail: chat, pluginNotifications: plugins, setMessagePanelOpen: setPanelOpen },
    mode, page, openIslandPage, collapseIsland, onOpenMessages: () => {}, host: islandHost,
  });
  collapse = collapseIsland;
  const heading = useArrivalsHeading(panel.arrivals);
  const art = useTrackArt();
  return <div className="stage" data-mode={mode} data-page={page}>
    {panel.arrivals && (
      <div className="island__expanded">
        {band && <NotchPopupBand page="qq" heading={heading ?? undefined} agentVisualState="idle" onCollapse={collapseIsland} />}
        <div className="message-panel">
          <MessageArrivalsPanel arrivals={panel.arrivals} onOpen={panel.open} onAction={panel.runAction} onMeasure={panel.measure} onShowAll={panel.showAll} onClearAll={panel.clearAll} media={{
            playing: true, cover: art?.cover ?? null, sourceIcon: art?.sourceIcon ?? null, sourceLabel: art?.sourceLabel ?? null, onPrevious: () => {}, onPlayPause: () => {}, onNext: () => {},
          }} />
        </div>
      </div>
    )}
  </div>;
}

const track = (title: string, durationMs = TRACK_MS): IslandNotice => ({
  pluginId: "@fuyu/now-playing", pluginName: null, title, body: "宋冬野", durationMs, actions: [], layout: "inline", controls: "media", iconUrl: NOTE,
});
const alarm: IslandNotice = { pluginId: "@fuyu/alarm", pluginName: null, title: "起床", body: "07:30", durationMs: PANEL_MS, actions: [], layout: "inline" };

const messages: string[] = [];
function check(condition: unknown, label: string) {
  if (!condition) throw new Error(label);
  messages.push(`PASS ${label}`);
}
const rows = () => [...document.querySelectorAll<HTMLElement>(".message-arrivals__item")];
const label = () => document.querySelector(".island__notch-band-label")?.textContent ?? null;
async function wait(ms: number) {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });
}
async function waitFor(condition: () => boolean, text: string, timeout = 2000) {
  const deadline = performance.now() + timeout;
  while (!condition()) {
    if (performance.now() > deadline) throw new Error(`等待超时：${text}`);
    await wait(30);
  }
}
async function deliver(notice: IslandNotice) {
  let shown = false;
  await act(async () => { shown = deliverNotice(notice); });
  return shown;
}
const results = document.getElementById("results")!;

async function runChecks() {
  try {
    updatePluginNames([{ id: "@fuyu/alarm", displayName: { "zh-CN": "闹钟", en: "Alarm" }, icon: "assets/icon.svg" }]);

    check(await deliver(track("安和桥")), "换歌提示在收起的岛上显示");
    await waitFor(() => rows().length === 1, "卡片弹出");
    check(label() === "切歌" && !document.querySelector(".island__notch-band-logo"), "认不出播放软件时标题是「切歌」，不是「消息」");
    check(rows()[0].querySelector<HTMLImageElement>(".message-brand-icon--app")?.src === NOTE, "没有封面时用插件自带的图标");

    await act(async () => setTrackArt({ cover: COVER, sourceLabel: "汽水音乐", sourceIcon: LOGO }));
    await waitFor(() => label() === "汽水音乐", "标题换成播放软件的名字");
    check(document.querySelector<HTMLImageElement>(".island__notch-band-logo")?.src === LOGO, "标题前是播放软件的图标");
    check(rows()[0].querySelector<HTMLImageElement>(".message-arrivals__art-main")?.src === COVER, "左边是专辑封面");
    check(rows()[0].querySelector<HTMLImageElement>(".message-arrivals__art-badge")?.src === LOGO, "封面角上是播放软件的图标");
    const from = () => rows()[0].querySelector<HTMLElement>(".message-arrivals__from");
    check(from()?.textContent === " · 汽水音乐" && getComputedStyle(from()!).display === "none", "有刘海下的标题带时，歌手后面不重复写软件名");
    await act(async () => setBand(false));
    check(getComputedStyle(from()!).display !== "none" && rows()[0].querySelector(".message-arrivals__body")?.textContent === "宋冬野 · 汽水音乐", "没有标题带的岛上，软件名接在歌手后面");
    await act(async () => setBand(true));

    const shownAt = performance.now();
    await waitFor(() => rows().length === 0, "卡片按提示自己的时长收起", PANEL_MS - 500);
    check(performance.now() - shownAt < PANEL_MS - 500, "没有等到「消息面板停留」的时长");

    check(await deliver(track("董小姐", PANEL_MS)), "下一首照常提示");
    await waitFor(() => rows().length === 1, "卡片再次弹出");
    const row = rows()[0].querySelector<HTMLButtonElement>(".message-arrivals__row")!;
    row.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    await act(async () => row.click());
    check(opened.join() === "music" && state.page === "music" && rows().length === 0, "点卡片打开音乐页，卡片收起");

    await act(async () => { setBlocked(true); });
    await wait(30);
    check(!(await deliver(track("斑马，斑马"))), "Agent 提示或聊天消息正在显示时，换歌提示不弹并如实回答没显示");
    await act(async () => { setBlocked(false); });
    await wait(30);
    check(state.mode === "expanded" && !(await deliver(alarm)), "岛展开着时别的插件提示也不弹");
    await act(async () => collapse());
    await wait(30);
    check(await deliver(alarm), "收起后别的插件提示照常显示");
    await waitFor(() => rows().length === 1 && label() === "闹钟", "别的插件的提示标题是插件自己的名字");
    const bandLogo = document.querySelector<HTMLImageElement>(".island__notch-band-logo")?.getAttribute("src") ?? "";
    check(bandLogo.endsWith("/packages/@fuyu/alarm/assets/icon.svg") && !rows()[0].querySelector(".message-arrivals__art"), "别的插件用自己的图标，不借用播放软件的图标和封面");
    const alarmRow = rows()[0].querySelector<HTMLButtonElement>(".message-arrivals__row")!;
    alarmRow.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    await act(async () => alarmRow.click());
    await waitFor(() => rows().length === 0 && state.mode === "collapsed", "点一下收起");

    results.textContent = messages.join("\n");
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
  setTrackArt({ cover: COVER, sourceLabel: "汽水音乐", sourceIcon: LOGO });
  for (const [text, notice] of [["换歌", track("安和桥")], ["闹钟", alarm]] as const) {
    const control = document.createElement("button");
    control.textContent = text;
    control.onclick = () => void deliverNotice(notice);
    document.getElementById("controls")!.append(control);
  }
  results.textContent = "点按钮看卡片；换歌约 3 秒后自己收起。";
}
