import { useCallback, useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowDown, ArrowUp, GripVertical, Trash2 } from "lucide-react";
import { useTranslation } from "../../i18n";
import type { MediaState } from "./api";
import type { KnownMediaSource } from "./storage";
import "./MusicSourceList.css";

export function MusicSourceList({
  sourcePriority,
  liveSessions,
  onReorderSource,
  onRemoveSource,
}: {
  sourcePriority: KnownMediaSource[];
  liveSessions: MediaState["sessions"];
  onReorderSource: (sourceId: string, targetId: string) => void;
  onRemoveSource: (sourceId: string) => void;
}) {
  const t = useTranslation();
  const [draggedSourceId, setDraggedSourceId] = useState<string | null>(null);
  const [dragOverSourceId, setDragOverSourceId] = useState<string | null>(null);

  const [liveRemoved, setLiveRemoved] = useState(false);

  useEffect(() => {
    if (!liveRemoved) {
      return;
    }
    const timer = window.setTimeout(() => setLiveRemoved(false), 4000);
    return () => window.clearTimeout(timer);
  }, [liveRemoved]);

  const removeSource = useCallback(
    (sourceId: string, live: boolean) => {
      onRemoveSource(sourceId);
      setLiveRemoved(live);
    },
    [onRemoveSource],
  );

  const getSourceIdAtPoint = useCallback((clientX: number, clientY: number) => {
    const element = document.elementFromPoint(clientX, clientY);
    const sourceElement = element?.closest("[data-source-id]");
    return sourceElement instanceof HTMLElement
      ? sourceElement.dataset.sourceId ?? null
      : null;
  }, []);

  const startSourceDrag = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, sourceId: string) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setDraggedSourceId(sourceId);
      setDragOverSourceId(null);
    },
    [],
  );

  const moveSourceDrag = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!draggedSourceId) {
        return;
      }
      event.preventDefault();
      const targetId = getSourceIdAtPoint(event.clientX, event.clientY);
      setDragOverSourceId(
        targetId && targetId !== draggedSourceId ? targetId : null,
      );
    },
    [draggedSourceId, getSourceIdAtPoint],
  );

  const finishSourceDrag = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!draggedSourceId) {
        return;
      }
      event.preventDefault();
      const targetId =
        dragOverSourceId || getSourceIdAtPoint(event.clientX, event.clientY);

      if (targetId && targetId !== draggedSourceId) {
        onReorderSource(draggedSourceId, targetId);
      }

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      setDraggedSourceId(null);
      setDragOverSourceId(null);
    },
    [dragOverSourceId, draggedSourceId, getSourceIdAtPoint, onReorderSource],
  );

  const cancelSourceDrag = useCallback(() => {
    setDraggedSourceId(null);
    setDragOverSourceId(null);
  }, []);

  return (
    <>
      {sourcePriority.length === 0 ? (
        <div className="music-source-empty">{t.music.noSources}</div>
      ) : (
        <div className="music-source-list" role="list">
          {sourcePriority.map((source, index) => {
            const live = liveSessions.find(
              (session) => session.id === source.id,
            );
            const prev = index > 0 ? sourcePriority[index - 1] : undefined;
            const next = index < sourcePriority.length - 1 ? sourcePriority[index + 1] : undefined;
            return (
              <div
                key={source.id}
                className={[
                  "music-source-item",
                  draggedSourceId === source.id
                    ? "music-source-item--dragging"
                    : "",
                  dragOverSourceId === source.id
                    ? "music-source-item--drag-over"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                role="listitem"
                data-source-id={source.id}
              >
                <button
                  className="music-source-drag"
                  type="button"
                  aria-label={t.music.reorderSource}
                  onPointerDown={(event) =>
                    startSourceDrag(event, source.id)
                  }
                  onPointerMove={moveSourceDrag}
                  onPointerUp={finishSourceDrag}
                  onPointerCancel={cancelSourceDrag}
                >
                  <GripVertical size={15} strokeWidth={2.4} />
                </button>
                <span
                  className={[
                    "music-source-dot",
                    live?.playing ? "music-source-dot--playing" : "",
                    live ? "music-source-dot--live" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-hidden="true"
                />
                <span className="music-source-label">
                  {source.label}
                </span>
                {sourcePriority.length > 1 && (
                  <span className="music-source-move">
                    <button
                      className="music-source-step"
                      type="button"
                      disabled={!prev}
                      aria-label={t.music.moveSourceUp(source.label)}
                      onClick={() => prev && onReorderSource(source.id, prev.id)}
                    >
                      <ArrowUp size={13} strokeWidth={2.2} />
                    </button>
                    <button
                      className="music-source-step"
                      type="button"
                      disabled={!next}
                      aria-label={t.music.moveSourceDown(source.label)}
                      onClick={() => next && onReorderSource(source.id, next.id)}
                    >
                      <ArrowDown size={13} strokeWidth={2.2} />
                    </button>
                  </span>
                )}
                <button
                  className="music-source-remove"
                  type="button"
                  aria-label={t.music.removeSource}
                  onClick={() => removeSource(source.id, Boolean(live))}
                >
                  <Trash2 size={14} strokeWidth={2.2} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      {liveRemoved && (
        <div className="music-source-note" role="status">
          {t.music.removeLiveSourceNote}
        </div>
      )}
    </>
  );
}
