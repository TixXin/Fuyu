import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Bookmark, Globe, GripVertical, Trash2 } from "lucide-react";
import { useTranslation } from "../../i18n";
import { openClipboardLink, type ClipboardLink } from "./api";
import { linkLabel, parseLink } from "./contentKind";
import { moveIndex } from "./linkRules";
import { useLinkPreview } from "./useLinkPreview";
import type { ClipboardLinksState } from "./useClipboardLinks";
import "./ClipboardLinksPanel.css";

type Drag = { id: string; from: number; to: number };

export function ClipboardLinksPanel({ state, icons }: { state: ClipboardLinksState; icons: boolean }) {
  const t = useTranslation().clipboard.links;
  const [drag, setDrag] = useState<Drag | null>(null);
  const rows = useRef(new Map<string, HTMLElement>());
  const links = state.links.links;
  const shown = drag ? moveIndex(links, drag.from, drag.to) : links;

  const indexAt = (y: number, id: string) => links.filter((link) => {
    const box = link.id === id ? null : rows.current.get(link.id)?.getBoundingClientRect();
    return box !== null && box !== undefined && y > box.top + box.height / 2;
  }).length;

  const startDrag = (event: PointerEvent<HTMLButtonElement>, link: ClipboardLink, index: number) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ id: link.id, from: index, to: index });
  };
  const finishDrag = () => {
    if (drag && drag.to !== drag.from) void state.move(drag.id, drag.to);
    setDrag(null);
  };
  const moveByKey = (event: KeyboardEvent, link: ClipboardLink, index: number) => {
    const step = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (!step || index + step < 0 || index + step >= links.length) return;
    event.preventDefault();
    void state.move(link.id, index + step);
  };

  if (links.length === 0) {
    return (
      <div className="island-list-empty">
        <span className="island-list-empty__icon" aria-hidden="true"><Bookmark size={22} strokeWidth={1.8} /></span>
        <strong>{t.empty}</strong>
        <small>{t.emptyHint}</small>
      </div>
    );
  }
  return (
    <div className={`island-list clipboard-links${drag ? " clipboard-links--dragging" : ""}`} role="list" aria-label={t.label}>
      {shown.map((link) => {
        const index = links.indexOf(link);
        return (
          <ClipboardLinkRow
            key={link.id}
            link={link}
            icons={icons}
            dragging={drag?.id === link.id}
            elementRef={(node) => {
              if (node) rows.current.set(link.id, node);
              else rows.current.delete(link.id);
            }}
            onGripDown={(event) => startDrag(event, link, index)}
            onGripMove={(event) => drag && setDrag({ ...drag, to: indexAt(event.clientY, drag.id) })}
            onGripUp={finishDrag}
            onGripKey={(event) => moveByKey(event, link, index)}
            onRemove={() => void state.remove(link.id)}
          />
        );
      })}
    </div>
  );
}

function ClipboardLinkRow({ link, icons, dragging, elementRef, onGripDown, onGripMove, onGripUp, onGripKey, onRemove }: {
  link: ClipboardLink;
  icons: boolean;
  dragging: boolean;
  elementRef: (node: HTMLElement | null) => void;
  onGripDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onGripMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onGripUp: () => void;
  onGripKey: (event: KeyboardEvent) => void;
  onRemove: () => void;
}) {
  const t = useTranslation().clipboard.links;
  const preview = useLinkPreview(link.url, icons);
  const url = parseLink(link.url);
  const label = url ? linkLabel(url) : link.url;
  const title = link.title || preview?.title || label;
  return (
    <article className={`island-list-row clipboard-link-row${dragging ? " clipboard-link-row--dragging" : ""}`} role="listitem" ref={elementRef}>
      <button className="island-list-row__hit" type="button" aria-label={t.open(title)} title={link.url} onClick={() => void openClipboardLink(link.url)} />
      <button
        className="clipboard-link-row__grip"
        type="button"
        aria-label={t.drag}
        title={t.dragHint}
        onPointerDown={onGripDown}
        onPointerMove={onGripMove}
        onPointerUp={onGripUp}
        onPointerCancel={onGripUp}
        onKeyDown={onGripKey}
      >
        <GripVertical size={14} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
      </button>
      <span className="island-list-row__lead" aria-hidden="true">
        {preview?.icon ? <img src={preview.icon} alt="" /> : <Globe size={16} strokeWidth={1.5} absoluteStrokeWidth />}
      </span>
      <span className="island-list-row__text">
        <span className="island-list-row__main">{title}</span>
        <span className="island-list-row__meta">{label}</span>
      </span>
      <span className="island-list-row__actions">
        <button className="island-list-icon-button" type="button" aria-label={t.remove} title={t.remove} onClick={onRemove}>
          <Trash2 size={14} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
        </button>
      </span>
    </article>
  );
}
