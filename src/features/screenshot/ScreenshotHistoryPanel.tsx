import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Images, Pin, Trash2 } from "lucide-react";
import { formatAgo } from "../../components/list/formatAgo";
import { useErrorText, useTranslation } from "../../i18n";
import { copyHistoryScreenshot, deleteHistoryScreenshot, dragScreenshot, pinHistoryScreenshot, type HistoryItem } from "./api";
import { useScreenshotHistory } from "./useScreenshotHistory";
import "../../components/list/IslandList.css";
import "./ScreenshotHistoryPanel.css";

const NOTICE_MS = 1800;
const DRAG_DISTANCE = 5;

export function ScreenshotHistoryPanel() {
  const t = useTranslation();
  const text = t.screenshot.history;
  const errorText = useErrorText();
  const { items, error, forget } = useScreenshotHistory();
  const [notice, setNotice] = useState<string | null>(null);
  const pressed = useRef<{ path: string; x: number; y: number } | null>(null);
  const now = Date.now();

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const report = (failure: unknown) => setNotice(errorText(failure));
  const copy = (item: HistoryItem) => copyHistoryScreenshot(item.path).then(() => setNotice(text.copied), report);
  const pin = (item: HistoryItem) => pinHistoryScreenshot(item.path).catch(report);
  const remove = (item: HistoryItem) => {
    forget(item.path);
    deleteHistoryScreenshot(item.path).catch(report);
  };
  const press = (item: HistoryItem, event: PointerEvent) => {
    if (event.button === 0) pressed.current = { path: item.path, x: event.clientX, y: event.clientY };
  };
  const move = (event: PointerEvent) => {
    const start = pressed.current;
    if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) < DRAG_DISTANCE) return;
    pressed.current = null;
    dragScreenshot(start.path).catch(report);
  };

  return (
    <section className="island-list-page screenshot-history" aria-label={text.title}>
      <div className="island-list-bar">
        <strong className="screenshot-history__title">{text.title}</strong>
        {items && items.length > 0 && <span className="island-list-count">{items.length}</span>}
        {(notice || error !== null) && <span className="island-list-notice" role="status">{notice ?? errorText(error)}</span>}
      </div>
      {items && items.length === 0 ? (
        <div className="island-list-empty">
          <span className="island-list-empty__icon" aria-hidden="true"><Images size={22} strokeWidth={1.8} /></span>
          <strong>{text.empty}</strong>
          <small>{text.emptyHint}</small>
        </div>
      ) : (
        <ul className="screenshot-history__grid" onPointerLeave={() => { pressed.current = null; }}>
          {(items ?? []).map((item) => (
            <li className="screenshot-history__item" key={item.path}>
              <button
                className="screenshot-history__shot"
                type="button"
                title={text.copyHint}
                aria-label={text.copyLabel(formatAgo(item.takenAt, now, t.common.ago))}
                onPointerDown={(event) => press(item, event)}
                onPointerMove={move}
                onPointerUp={() => { pressed.current = null; }}
                onClick={() => void copy(item)}
              >
                {item.thumbnail ? <img src={item.thumbnail} alt="" draggable={false} /> : <Images size={20} aria-hidden="true" />}
              </button>
              <span className="screenshot-history__time">{formatAgo(item.takenAt, now, t.common.ago)}</span>
              <span className="screenshot-history__actions">
                <button className="island-list-icon-button" type="button" aria-label={text.pin} title={text.pin} onClick={() => void pin(item)}>
                  <Pin size={13} aria-hidden="true" />
                </button>
                <button className="island-list-icon-button" type="button" aria-label={text.remove} title={text.remove} onClick={() => remove(item)}>
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
