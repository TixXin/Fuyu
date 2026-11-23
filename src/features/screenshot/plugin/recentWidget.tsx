import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Images, Pin, Scissors } from "lucide-react";
import { clickOnly } from "../../../components/island-widget/clickOnly";
import { panelInterval } from "../../../components/island-widget/panelAwake";
import { useWidgetFlash } from "../../../components/island-widget/useWidgetFlash";
import { WidgetFrame } from "../../../components/island-widget/WidgetFrame";
import { WidgetOpenButton } from "../../../components/island-widget/WidgetOpenButton";
import { formatAgo } from "../../../components/list/formatAgo";
import { useErrorText, useTranslation } from "../../../i18n";
import { copyHistoryScreenshot, dragScreenshot, pinHistoryScreenshot, startScreenshot } from "../api";
import { useScreenshotHistory } from "../useScreenshotHistory";
import { screenshotIsland } from "./islandState";
import "./recentWidget.css";

const DRAG_PX = 4;

export function RecentScreenshotWidget() {
  const t = useTranslation();
  const errorText = useErrorText();
  const text = t.islandWidgets;
  const { items } = useScreenshotHistory();
  const { openHistory } = screenshotIsland.use();
  const { flash, track } = useWidgetFlash();
  const [now, setNow] = useState(() => Date.now());
  const pressed = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);
  useEffect(() => panelInterval(() => setNow(Date.now()), 30_000), []);
  const latest = items?.reduce<(typeof items)[number] | null>((best, item) => (!best || item.takenAt > best.takenAt ? item : best), null) ?? null;
  const failed = { failed: (failure: unknown) => errorText(failure) };
  const take = clickOnly(() => void track(() => startScreenshot("region"), failed));
  const press = (event: PointerEvent) => {
    event.stopPropagation();
    dragged.current = false;
    pressed.current = event.button === 0 ? { x: event.clientX, y: event.clientY } : null;
  };
  const move = (event: PointerEvent) => {
    const from = pressed.current;
    if (!from || !latest) return;
    if ((event.buttons & 1) === 0 || Math.hypot(event.clientX - from.x, event.clientY - from.y) < DRAG_PX) return;
    pressed.current = null;
    dragged.current = true;
    void track(() => dragScreenshot(latest.path), failed);
  };
  const aside = openHistory ? <WidgetOpenButton label={text.content.openScreenshots} onOpen={openHistory} /> : null;
  return (
    <WidgetFrame icon={Scissors} title={text.widgets.screenshot} aside={aside} className="shot-widget" flash={flash}>
      <div className="shot-widget__body">
        {latest ? (
          <>
            <button
              className="shot-widget__picture"
              type="button"
              aria-label={text.content.copyScreenshot}
              title={text.content.screenshotHint}
              onPointerDown={press}
              onPointerMove={move}
              onPointerUp={() => {
                pressed.current = null;
              }}
              onClick={clickOnly(() => {
                if (!dragged.current) void track(() => copyHistoryScreenshot(latest.path), { done: text.content.copied, ...failed });
              })}
            >
              {latest.thumbnail ? <img src={latest.thumbnail} alt="" draggable={false} /> : <Images size={20} aria-hidden="true" />}
              <span className="shot-widget__ago">{formatAgo(latest.takenAt, now, t.common.ago)}</span>
            </button>
            <button className="shot-widget__pin" type="button" aria-label={text.content.pinScreenshot} title={text.content.pinScreenshot} onClick={clickOnly(() => void track(() => pinHistoryScreenshot(latest.path), failed))}>
              <Pin size={12} strokeWidth={2.4} aria-hidden="true" />
            </button>
          </>
        ) : (
          <span className="island-widget__empty">{text.content.noScreenshots}</span>
        )}
        <button className="shot-widget__take" type="button" aria-label={text.content.takeScreenshot} title={text.content.takeScreenshot} onClick={take}>
          <Scissors size={12} strokeWidth={2.4} />
        </button>
      </div>
    </WidgetFrame>
  );
}
