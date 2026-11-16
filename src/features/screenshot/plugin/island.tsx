import { Scissors } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { defineSlot, type IslandHeaderMeta, type IslandNoticeMeta, type IslandPageMeta } from "../../plugin-kernel/slots";
import { RecordingNotice, RecordingNoticeActions } from "../RecordingNotice";
import { ScreenshotNotice, ScreenshotNoticeActions } from "../ScreenshotNotice";
import type { RecordingNoticeState } from "../useRecording";
import type { ScreenshotNoticeState } from "../useScreenshotNotice";
import { ScreenshotHistoryPanel } from "../ScreenshotHistoryPanel";
import { islandPage } from "./page.ts";

type ScreenshotsPageProps = { embedded?: boolean };

const pageSlot = defineSlot<ScreenshotsPageProps, IslandPageMeta<Readonly<Record<string, unknown>>>>("island.page/v1");

function ScreenshotsPage({ embedded }: ScreenshotsPageProps) {
  return embedded ? <ScreenshotHistoryPanel embedded /> : <ScreenshotHistoryPanel />;
}

type HeaderContext = { onScreenshot: (() => void) | null };

const headerSlot = defineSlot<HeaderContext, IslandHeaderMeta<HeaderContext>>("island.header/v1");

function ScreenshotButton({ onScreenshot }: HeaderContext) {
  const t = useTranslation();
  return (
    <button
      className="icon-button island-screenshot-button"
      type="button"
      aria-label={t.island.screenshot}
      onClick={(event) => {
        event.stopPropagation();
        onScreenshot?.();
      }}
    >
      <Scissors size={16} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
    </button>
  );
}

pageSlot.add({ ...islandPage, component: ScreenshotsPage });
headerSlot.add({ id: "screenshot", order: 40, enabled: ({ onScreenshot }) => Boolean(onScreenshot), component: ScreenshotButton });

type NoticeSources = { recording: RecordingNoticeState; screenshotNotice: ScreenshotNoticeState };

const noticeSlot = defineSlot<NoticeSources, IslandNoticeMeta<NoticeSources>>("island.notice/v1");

function RecordingContent({ recording }: NoticeSources) {
  return <RecordingNotice recording={recording} />;
}

function RecordingActions({ recording }: NoticeSources) {
  return <RecordingNoticeActions recording={recording} />;
}

function ScreenshotContent({ screenshotNotice }: NoticeSources) {
  return <ScreenshotNotice key={screenshotNotice.taken?.path} notice={screenshotNotice} />;
}

function ScreenshotActions({ screenshotNotice }: NoticeSources) {
  return <ScreenshotNoticeActions notice={screenshotNotice} />;
}

noticeSlot.add({ id: "recording", order: 10, active: ({ recording }) => recording.shown, component: RecordingContent, actions: RecordingActions });
noticeSlot.add({ id: "screenshot", order: 40, active: ({ screenshotNotice }) => Boolean(screenshotNotice.taken), component: ScreenshotContent, actions: ScreenshotActions });
