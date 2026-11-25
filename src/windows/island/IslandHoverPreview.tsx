import { useEffect, useState, type CSSProperties, type WheelEvent } from "react";
import { Bot, Calendar, Clock, ListTodo, Mail, Music } from "lucide-react";
import { runIslandAction, useIslandContributed } from "../../features/plugin-kernel/useIslandContributions";
import { useLocale, useTranslation } from "../../i18n";
import {
  buildPreviewCards,
  pickVisibleCards,
  PREVIEW_ROTATE_MS,
  type PreviewCardKind,
} from "./hoverPreview";
import type { IslandPage } from "./types";
import "./IslandHoverPreview.css";

const ICONS: Record<PreviewCardKind, typeof Bot> = {
  agent: Bot,
  meeting: Calendar,
  music: Music,
  unread: Mail,
  calendar: Calendar,
  todo: ListTodo,
  clock: Clock,
};

export function IslandHoverPreview({
  homePage,
  autoExpandMs,
  onOpenPage,
  onExpand,
  onClose,
}: {
  homePage: IslandPage;
  autoExpandMs: number;
  onOpenPage: (page: IslandPage) => void;
  onExpand: () => void;
  onClose: () => void;
}) {
  const t = useTranslation();
  const { locale } = useLocale();
  const contributed = useIslandContributed();
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(() => new Date());

  const labels: Record<PreviewCardKind, string> = {
    agent: t.island.sideDock.pageNames.agents,
    meeting: t.island.calendar,
    music: t.island.music,
    unread: t.island.sideDock.pageNames.qq,
    calendar: t.island.calendar,
    todo: t.island.todoList,
    clock: t.island.appName,
  };

  const allCards = buildPreviewCards(contributed.lines, {
    homePage,
    now,
    locale,
    labels,
    musicPlayback: contributed.playback
      ? { playing: true }
      : null,
  });
  const cards = pickVisibleCards(allCards);
  const safeIndex = index % Math.max(1, cards.length);
  const current = cards[safeIndex];

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (cards.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((currentIndex) => (currentIndex + 1) % cards.length);
    }, PREVIEW_ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [cards.length]);

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaY) < 4) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.deltaY > 0) {
      onClose();
      onExpand();
    } else {
      onClose();
    }
  };

  if (!current) return null;
  const Icon = ICONS[current.kind];

  return (
    <div
      className="island-preview"
      role="region"
      aria-label={t.settings.expand.preview}
      onWheel={handleWheel}
      onClick={(event) => {
        event.stopPropagation();
        onClose();
        onOpenPage(current.page);
      }}
    >
      <div className="island-preview__card" data-urgent={current.urgent || undefined}>
        <span className="island-preview__icon" aria-hidden="true">
          <Icon size={15} strokeWidth={1.8} absoluteStrokeWidth />
        </span>
        <div className="island-preview__body">
          <span className="island-preview__title">{current.title}</span>
          <span className="island-preview__sub">{current.subtitle}</span>
        </div>
        {current.action && (
          <button
            type="button"
            className="island-preview__action"
            onClick={(event) => {
              event.stopPropagation();
              runIslandAction(current.action!.id);
            }}
          >
            {current.action.label}
          </button>
        )}
        {cards.length > 1 && (
          <div
            className="island-preview__dots"
            role="tablist"
            aria-label={t.settings.expand.preview}
            onClick={(event) => event.stopPropagation()}
          >
            {cards.map((card, dotIndex) => (
              <button
                key={card.id}
                type="button"
                role="tab"
                aria-selected={dotIndex === safeIndex}
                aria-label={card.title}
                className={`island-preview__dot${dotIndex === safeIndex ? " island-preview__dot--active" : ""}`}
                onClick={() => setIndex(dotIndex)}
              />
            ))}
          </div>
        )}
      </div>
      {autoExpandMs > 0 && (
        <span
          className="island-preview__progress"
          style={{ "--preview-progress-ms": `${autoExpandMs}ms` } as CSSProperties}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
