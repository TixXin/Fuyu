import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Check, Copy, Images, Pin, Trash2 } from "lucide-react";
import { useErrorText, useTranslation } from "../../i18n";
import { copyHistoryScreenshot, deleteHistoryScreenshot, dragScreenshot, pinHistoryScreenshot, type HistoryItem } from "./api";
import { clockTime, groupByDay, type HistoryDay } from "./historyDays";
import { useScreenshotHistory } from "./useScreenshotHistory";
import "../../components/list/IslandList.css";
import "./ScreenshotHistoryPanel.css";

const NOTICE_MS = 1800;
const DRAG_DISTANCE = 5;
const CLOCK_MS = 60_000;

export function ScreenshotHistoryPanel({ embedded = false }: { embedded?: boolean }) {
  const t = useTranslation();
  const text = t.screenshot.history;
  const errorText = useErrorText();
  const { items, error, forget } = useScreenshotHistory();
  const [notice, setNotice] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const pressed = useRef<{ path: string; x: number; y: number } | null>(null);
  const days = useMemo(() => groupByDay(items ?? [], now), [items, now]);
  const thisYear = new Date(now).getFullYear();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), CLOCK_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!copiedPath) return;
    const timer = window.setTimeout(() => setCopiedPath(null), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [copiedPath]);

  const report = (failure: unknown) => setNotice(errorText(failure));
  const copy = (item: HistoryItem) => copyHistoryScreenshot(item.path).then(() => setCopiedPath(item.path), report);
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
  const dayLabel = (day: HistoryDay<HistoryItem>) =>
    day.kind === "today" ? text.today : day.kind === "yesterday" ? text.yesterday : text.date(day.year === thisYear ? null : day.year, day.month, day.day);
  const status = notice ?? (error !== null ? errorText(error) : null);

  return (
    <section className={embedded ? "screenshot-history screenshot-history--embedded" : "island-list-page screenshot-history"} aria-label={text.title}>
      {!embedded && (
        <div className="island-list-bar">
          <strong className="screenshot-history__title">{text.title}</strong>
          {items && items.length > 0 && <span className="screenshot-history__hint">{text.copyHint}</span>}
          {items && items.length > 0 && <span className="island-list-count">{items.length}</span>}
        </div>
      )}
      {items && items.length === 0 ? (
        <div className="island-list-empty">
          <span className="island-list-empty__icon" aria-hidden="true"><Images size={22} strokeWidth={1.8} /></span>
          <strong>{text.empty}</strong>
          <small>{text.emptyHint}</small>
        </div>
      ) : (
        <div className="screenshot-history__scroll" onPointerLeave={() => { pressed.current = null; }}>
          {days.map((day) => (
            <section className="screenshot-history__day" key={day.key} aria-label={dayLabel(day)}>
              <h3 className="screenshot-history__day-title">
                <span>{dayLabel(day)}</span>
                <small>{text.dayCount(day.items.length)}</small>
              </h3>
              <ul className="screenshot-history__grid">
                {day.items.map((item) => (
                  <li className={`screenshot-history__item${copiedPath === item.path ? " screenshot-history__item--copied" : ""}`} key={item.path}>
                    <button
                      className="screenshot-history__shot"
                      type="button"
                      title={text.copyHint}
                      aria-label={text.copyLabel(`${dayLabel(day)} ${clockTime(item.takenAt)}`)}
                      onPointerDown={(event) => press(item, event)}
                      onPointerMove={move}
                      onPointerUp={() => { pressed.current = null; }}
                      onClick={() => void copy(item)}
                    >
                      {item.thumbnail ? <img src={item.thumbnail} alt="" draggable={false} /> : <Images size={22} aria-hidden="true" />}
                      <span className="screenshot-history__time">{clockTime(item.takenAt)}</span>
                      {copiedPath === item.path && (
                        <span className="screenshot-history__copied" role="status">
                          <Check size={14} strokeWidth={2.6} aria-hidden="true" />
                          {text.copied}
                        </span>
                      )}
                    </button>
                    <span className="screenshot-history__actions">
                      <button type="button" aria-label={text.copy} title={text.copy} onClick={() => void copy(item)}>
                        <Copy size={13} aria-hidden="true" />
                      </button>
                      <button type="button" aria-label={text.pin} title={text.pin} onClick={() => void pin(item)}>
                        <Pin size={13} aria-hidden="true" />
                      </button>
                      <button className="screenshot-history__danger" type="button" aria-label={text.remove} title={text.remove} onClick={() => remove(item)}>
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {status && <span className="screenshot-history__toast" role="status">{status}</span>}
    </section>
  );
}
