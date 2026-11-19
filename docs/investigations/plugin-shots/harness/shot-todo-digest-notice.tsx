import { StrictMode, useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import { messagesV1 } from "@fuyu/plugin-services";
import "../../src/styles/tokens.css";
import "../../src/windows/island/IslandApp";
import { MessageArrivalsPanel } from "../../src/features/messages/arrivals/MessageArrivalsPanel";
import { useIslandMessagePanel } from "../../src/features/messages/island/useIslandMessagePanel";
import { useLatestMessagePreview } from "../../src/features/messages/island/useLatestMessagePreview";
import { usePluginNotifications } from "../../src/features/messages/island/usePluginNotifications";
import { messageArrivalsPanelHeight } from "../../src/features/messages/plugin/islandMessages";
import "../../src/features/messages/plugin/services";
import { updatePluginNames } from "../../src/features/plugin-kernel/pluginNames";
import { windowServices } from "../../src/features/plugin-kernel/services";
import { LOCALE_STORAGE_KEY } from "../../src/i18n";
import { DEFAULT_SETTINGS } from "../../src/lib/settings/settingsDefaults";
import { getExpandedIslandHeight } from "../../src/windows/island/expandedHeight";
import { islandHost } from "../../src/windows/island/islandHost";
import { IslandShell } from "../../src/windows/island/IslandShell";
import { getIslandStageStyle } from "../../src/windows/island/stageStyle";
import type { IslandMode, IslandPage } from "../../src/windows/island/types";
import { useIslandPopup } from "../../src/windows/island/useIslandPopup";
import manifest from "../../plugins/v3/official/todo-digest/package.json";
import data from "./shot-data.json";

type Report = { state: "pending" } | { state: "failed"; error: string } | { state: "ready"; rect: { x: number; y: number; width: number; height: number } };
const report = (value: Report) => Object.assign(window, { __shot: value });
report({ state: "pending" });

const LOCALE = "zh-CN";
const MARGIN = 8;
const fixed = data.todoDigest.state.lastWrittenAt;
const RealDate = Date;
globalThis.Date = class extends RealDate {
  constructor(...args: unknown[]) {
    if (args.length === 0) super(fixed);
    else super(...(args as [number]));
  }
  static now() {
    return fixed;
  }
} as DateConstructor;
localStorage.setItem(LOCALE_STORAGE_KEY, LOCALE);
Object.assign(globalThis, { isTauri: true });
mockIPC(() => null, { shouldMockEvents: true });

type Notices = Parameters<typeof useIslandMessagePanel>[0]["notices"];
const QUIET = { preview: null, previewReceivedAt: null, previewMessage: null, previewAccount: null, snapshot: { items: [] } };
const FEATURES = { todo: true, music: true, clipboard: true, shelf: true, qq: true, wechat: true, qqMail: true, agents: true, translation: true, calendar: true, screenshots: true, timer: true };
const settings = DEFAULT_SETTINGS;

function Fixture() {
  const [mode, setMode] = useState<IslandMode>("collapsed");
  const [page, setPage] = useState<IslandPage>("todo");
  const [panelOpen, setPanelOpen] = useState(false);
  const plugins = usePluginNotifications(mode === "collapsed" || panelOpen);
  const chat = QUIET as unknown as Notices["qqNotifications"] & Notices["wechatReminders"] & Notices["qqMail"];
  const preview = useLatestMessagePreview(chat, chat, chat, plugins);
  const openIslandPage = useCallback((next: IslandPage) => {
    setPage(next);
    setMode("expanded");
  }, []);
  const collapseIsland = useCallback(() => setMode("collapsed"), []);
  const panel = useIslandMessagePanel({
    enabled: true,
    durationMs: settings.messagePanelSeconds * 1000,
    notices: { preview, qqNotifications: chat, wechatReminders: chat, qqMail: chat, pluginNotifications: plugins, setMessagePanelOpen: setPanelOpen },
    mode,
    page,
    openIslandPage,
    collapseIsland,
    onOpenMessages: () => undefined,
    host: islandHost,
  });
  const { popup, expandedIslandWidth } = useIslandPopup(mode, panel.arrivals !== null);
  const height = getExpandedIslandHeight({
    maxPanelHeight: settings.maxPanelHeight,
    panel: page === "qq" && panel.arrivals ? { height: messageArrivalsPanelHeight(panel.height, settings.maxPanelHeight) } : undefined,
    popup,
  });
  return (
    <main className={`stage stage--font-${settings.fontFamily}`} data-mode={mode} data-page={page} style={getIslandStageStyle(settings, mode, 300, height, expandedIslandWidth)}>
      <IslandShell
        mode={mode}
        page={page}
        popup={popup}
        isTucked={false}
        isDetached={true}
        showTitle={settings.showTitle}
        showCollapsedText={true}
        appearanceMode={settings.appearanceMode}
        nativeGlassState="disabled"
        features={FEATURES}
        onOpenPage={openIslandPage}
        onPageChange={setPage}
        onWindowDragStart={() => undefined}
        onCollapse={collapseIsland}
        onResetPosition={() => undefined}
        minimizesToTray
        onMinimize={() => undefined}
        onOpenSettings={() => undefined}
        onOpenTranslator={() => undefined}
        onTuck={() => undefined}
        onReveal={() => undefined}
        pageDigitModifiers={settings.pageDigitModifiers}
        hoverSwitchPage={false}
        hoverSwitchDelayMs={0}
      >
        {page === "qq" && panel.arrivals && (
          <div className="message-panel">
            <MessageArrivalsPanel arrivals={panel.arrivals} onOpen={panel.open} onAction={panel.runAction} onMeasure={panel.measure} onShowAll={panel.showAll} onClearAll={panel.clearAll} />
          </div>
        )}
      </IslandShell>
    </main>
  );
}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function main() {
  updatePluginNames([{ id: manifest.name, displayName: manifest.fuyu.displayName, icon: manifest.fuyu.icon }]);
  createRoot(document.getElementById("fixture")!).render(
    <StrictMode>
      <Fixture />
    </StrictMode>,
  );
  await sleep(300);
  const answer = await windowServices.get(messagesV1).notify(data.todoDigest.notice);
  if (!answer.shown) throw new Error("the island did not show the notice");
  const deadline = performance.now() + 4000;
  while (!document.querySelector(".message-arrivals__item")) {
    if (performance.now() > deadline) throw new Error("the notice row did not appear");
    await sleep(50);
  }
  await document.fonts.ready;
  await sleep(1200);
  const row = document.querySelector<HTMLElement>(".message-arrivals__item");
  if (!row) throw new Error("the notice went away before the capture");
  const box = document.querySelector<HTMLElement>(".island")!.getBoundingClientRect();
  report({ state: "ready", rect: { x: box.x - MARGIN, y: box.y - MARGIN, width: box.width + 2 * MARGIN, height: box.height + 2 * MARGIN } });
}

main().catch((error: unknown) => report({ state: "failed", error: error instanceof Error ? error.message : String(error) }));
