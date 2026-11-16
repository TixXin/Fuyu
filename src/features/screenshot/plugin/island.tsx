import { Scissors } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { defineSlot, type IslandHeaderMeta, type IslandNoticeMeta, type IslandPageMeta } from "../../plugin-kernel/slots";
import { runIslandAction } from "../../plugin-kernel/useIslandContributions";
import { RecordingNotice, RecordingNoticeActions } from "../RecordingNotice";
import { ScreenshotNotice, ScreenshotNoticeActions } from "../ScreenshotNotice";
import { ScreenshotHistoryPanel } from "../ScreenshotHistoryPanel";
import { islandPage } from "./page.ts";
import { screenshotIsland } from "./islandState";

type ScreenshotsPageProps = { embedded?: boolean };

const pageSlot = defineSlot<ScreenshotsPageProps, IslandPageMeta<Readonly<Record<string, unknown>>>>("island.page/v1");

function ScreenshotsPage({ embedded }: ScreenshotsPageProps) {
  return embedded ? <ScreenshotHistoryPanel embedded /> : <ScreenshotHistoryPanel />;
}

type HeaderContext = { hints: ReadonlySet<string> };

const headerSlot = defineSlot<HeaderContext, IslandHeaderMeta<HeaderContext>>("island.header/v1");

function ScreenshotButton() {
  const t = useTranslation();
  return (
    <button
      className="icon-button island-screenshot-button"
      type="button"
      aria-label={t.island.screenshot}
      onClick={(event) => {
        event.stopPropagation();
        runIslandAction("screenshot.start");
      }}
    >
      <Scissors size={16} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
    </button>
  );
}

pageSlot.add({ ...islandPage, component: ScreenshotsPage });
headerSlot.add({ id: "screenshot", order: 40, enabled: ({ hints }) => hints.has("screenshot.start"), component: ScreenshotButton });

type NoticeSources = object;

const noticeSlot = defineSlot<NoticeSources, IslandNoticeMeta<NoticeSources>>("island.notice/v1");

function RecordingContent() {
  const { recording } = screenshotIsland.use();
  return recording && <RecordingNotice recording={recording} />;
}

function RecordingActions() {
  const { recording } = screenshotIsland.use();
  return recording && <RecordingNoticeActions recording={recording} />;
}

function ScreenshotContent() {
  const { notice } = screenshotIsland.use();
  return notice && <ScreenshotNotice key={notice.taken?.path} notice={notice} />;
}

function ScreenshotActions() {
  const { notice } = screenshotIsland.use();
  return notice && <ScreenshotNoticeActions notice={notice} />;
}

noticeSlot.add({ id: "recording", order: 10, component: RecordingContent, actions: RecordingActions });
noticeSlot.add({ id: "screenshot", order: 40, component: ScreenshotContent, actions: ScreenshotActions });
