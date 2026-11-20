import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";
import { Check, Copy, Images, Pin, Search, Sparkles, Trash2, X } from "lucide-react";
import { useErrorText, useLocale, useTranslation } from "../../i18n";
import { visibilityInterval } from "../../lib/useVisibilityInterval";
import { copyHistoryScreenshot, deleteHistoryScreenshot, dragScreenshot, pinHistoryScreenshot, type HistoryItem } from "./api";
import { screenshotActions, subscribeScreenshotActions, type ScreenshotActionItem } from "./host/actions.mjs";
import { clockTime, groupByDay, type HistoryDay } from "./historyDays";
import { HistoryMarks } from "./HistoryMarks";
import { searchHistory } from "./historySearch";
import { useScreenshotHistory } from "./useScreenshotHistory";
import "../../components/list/IslandList.css";
import "./ScreenshotHistoryPanel.css";

const NOTICE_MS = 1800;
const DRAG_DISTANCE = 5;
const CLOCK_MS = 60_000;
const NO_ACTIONS: readonly ScreenshotActionItem[] = [];
let cachedHistoryActions: readonly ScreenshotActionItem[] = NO_ACTIONS;
let cachedHistoryKey = "";

function readHistoryActions(): readonly ScreenshotActionItem[] {
  const list = screenshotActions.list();
  if (list.length === 0) return NO_ACTIONS;
  const key = JSON.stringify(list);
  if (key !== cachedHistoryKey) {
    cachedHistoryKey = key;
    cachedHistoryActions = list;
  }
  return cachedHistoryActions;
}

export function ScreenshotHistoryPanel({ embedded = false }: { embedded?: boolean }) {
  const t = useTranslation();
  const { locale } = useLocale();
  const text = t.screenshot.history;
  const errorText = useErrorText();
  const { items, error, forget } = useScreenshotHistory();
  const extraActions = useSyncExternalStore(subscribeScreenshotActions, readHistoryActions, readHistoryActions);
  const [notice, setNotice] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const pressed = useRef<{ path: string; x: number; y: number } | null>(null);
  const [query, setQuery] = useState("");
  const matches = useMemo(() => searchHistory(items ?? [], query), [items, query]);
  const hitsOf = useMemo(() => new Map(matches.map((match) => [match.item.path, match.hits])), [matches]);
  const days = useMemo(() => groupByDay(matches.map((match) => match.item), now), [matches, now]);
  const thisYear = new Date(now).getFullYear();

  useEffect(() => {
    return visibilityInterval(() => setNow(Date.now()), CLOCK_MS);
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
      {items && items.length > 0 && (
        <label className="screenshot-history__search">
          <Search size={13} aria-hidden="true" />
          <input type="search" value={query} placeholder={text.search} aria-label={text.search} spellCheck={false} onChange={(event) => setQuery(event.target.value)} />
          {query && (
            <button type="button" aria-label={text.clearSearch} title={text.clearSearch} onClick={() => setQuery("")}>
              <X size={12} aria-hidden="true" />
            </button>
          )}
        </label>
      )}
      {items && items.length > 0 && matches.length === 0 ? (
        <div className="island-list-empty screenshot-history__no-match">
          <span className="island-list-empty__icon" aria-hidden="true"><Search size={22} strokeWidth={1.8} /></span>
          <strong>{text.noMatch(query.trim())}</strong>
        </div>
      ) : items && items.length === 0 ? (
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
                      {item.thumbnail ? <img src={item.thumbnail} alt="" loading="lazy" decoding="async" draggable={false} /> : <Images size={22} aria-hidden="true" />}
                      {item.thumbnail && <HistoryMarks width={item.width} height={item.height} hits={hitsOf.get(item.path) ?? []} />}
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
                      {extraActions.map((action) => {
                        const label = action.label[locale];
                        return (
                          <button
                            key={action.id}
                            type="button"
                            aria-label={label}
                            title={action.disabled && action.disabledTitle ? action.disabledTitle[locale] : label}
                            disabled={action.disabled}
                            onClick={() =>
                              void screenshotActions
                                .run(action.id, { path: item.path, saved: true, thumbnail: item.thumbnail ?? null })
                                .then((result) => result.message && setNotice(result.message), report)
                            }
                          >
                            <Sparkles size={13} aria-hidden="true" />
                          </button>
                        );
                      })}
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
