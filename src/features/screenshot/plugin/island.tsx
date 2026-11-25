import { lazy, useEffect, useRef, useState } from "react";
import { Scissors } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { defineSlot, type IslandHeaderMeta, type IslandNoticeMeta, type IslandPageMeta } from "../../plugin-kernel/slots";
import { runIslandAction } from "../../plugin-kernel/useIslandContributions";
import { DelayNotice, DelayNoticeActions } from "../DelayNotice";
import { RecordingNotice, RecordingNoticeActions } from "../RecordingNotice";
import { ScreenshotNotice, ScreenshotNoticeActions } from "../ScreenshotNotice";
import { DELAY_SECONDS } from "../settings";
import { islandPage } from "./page.ts";
import { screenshotIsland } from "./islandState";
import { OWNER } from "./owner.ts";
import "../ScreenshotDelayMenu.css";

const ScreenshotHistoryPanel = lazy(() => import("../ScreenshotHistoryPanel").then((m) => ({ default: m.ScreenshotHistoryPanel })));

type ScreenshotsPageProps = { embedded?: boolean };

const pageSlot = defineSlot<ScreenshotsPageProps, IslandPageMeta<Readonly<Record<string, unknown>>>>("island.page/v1");

function ScreenshotsPage({ embedded }: ScreenshotsPageProps) {
  return embedded ? <ScreenshotHistoryPanel embedded /> : <ScreenshotHistoryPanel />;
}

type HeaderContext = { hints: ReadonlySet<string> };

const headerSlot = defineSlot<HeaderContext, IslandHeaderMeta<HeaderContext>>("island.header/v1");

function ScreenshotButton() {
  const t = useTranslation();
  const { startDelayed } = screenshotIsland.use();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && event.target instanceof Node && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  return (
    <span className="island-screenshot-control" ref={rootRef}>
      <button
        className="icon-button island-screenshot-button"
        type="button"
        aria-label={t.island.screenshot}
        title={t.screenshot.delay.buttonHint}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(false);
          runIslandAction("screenshot.start");
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (startDelayed) setOpen((current) => !current);
        }}
      >
        <Scissors size={16} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
      </button>
      {open && startDelayed && (
        <div
          className="island-screenshot-delay-menu"
          role="menu"
          aria-label={t.screenshot.delay.menu}
          onClick={(event) => event.stopPropagation()}
        >
          {DELAY_SECONDS.map((seconds) => (
            <button
              key={seconds}
              type="button"
              role="menuitem"
              className="island-screenshot-delay-menu__item"
              onClick={() => {
                setOpen(false);
                startDelayed(seconds);
              }}
            >
              <span>{t.screenshot.delay.option(seconds)}</span>
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

pageSlot.add({ ...islandPage, component: ScreenshotsPage }, OWNER);
headerSlot.add({ id: "screenshot", order: 40, enabled: ({ hints }) => hints.has("screenshot.start"), component: ScreenshotButton }, OWNER);

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

function DelayContent() {
  const { delay } = screenshotIsland.use();
  return delay && <DelayNotice delay={delay} />;
}

function DelayActions() {
  const { delay } = screenshotIsland.use();
  return delay && <DelayNoticeActions delay={delay} />;
}

function ScreenshotContent() {
  const { notice } = screenshotIsland.use();
  return notice && <ScreenshotNotice key={notice.taken?.path} notice={notice} />;
}

function ScreenshotActions() {
  const { notice } = screenshotIsland.use();
  return notice && <ScreenshotNoticeActions notice={notice} />;
}

noticeSlot.add({ id: "recording", order: 10, component: RecordingContent, actions: RecordingActions }, OWNER);
noticeSlot.add({ id: "delay", order: 15, component: DelayContent, actions: DelayActions }, OWNER);
noticeSlot.add({ id: "screenshot", order: 40, component: ScreenshotContent, actions: ScreenshotActions }, OWNER);
