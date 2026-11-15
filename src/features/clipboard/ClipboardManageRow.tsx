import { Check, Star } from "lucide-react";
import { memo, type MouseEvent } from "react";
import { formatAgo } from "../../components/list/formatAgo";
import { useTranslation } from "../../i18n";
import type { ClipboardHistoryItem } from "./api";
import { contentKind } from "./contentKind";
import { ClipboardRowLead } from "./ClipboardRowLead";
import { entryMainLabel, entryMetaLabel } from "./rowLabels";

export const MANAGE_ROW_HEIGHT = 46;

export const ClipboardManageRow = memo(function ClipboardManageRow({ entry, index, now, picked, focused, onClick, onCheck, onToggleFavorite }: {
  entry: ClipboardHistoryItem;
  index: number;
  now: number;
  picked: boolean;
  focused: boolean;
  onClick: (index: number, event: MouseEvent) => void;
  onCheck: (index: number, event: MouseEvent) => void;
  onToggleFavorite: (id: string) => void;
}) {
  const t = useTranslation();
  const text = t.clipboard;
  const kind = contentKind(entry);
  const main = entryMainLabel(entry, kind, text);
  const meta = entryMetaLabel(entry, t);
  const className = ["clipboard-manage__row", picked ? "clipboard-manage__row--picked" : "", focused ? "clipboard-manage__row--focused" : ""].filter(Boolean).join(" ");

  return (
    <li data-index={index} role="option" aria-selected={picked} className={className} style={{ height: MANAGE_ROW_HEIGHT }}>
      <button
        type="button"
        role="checkbox"
        tabIndex={-1}
        aria-checked={picked}
        aria-label={text.manage.pick(main)}
        className="clipboard-manage__check"
        onClick={(event) => onCheck(index, event)}
      >
        {picked && <Check size={11} strokeWidth={3} />}
      </button>
      <button type="button" tabIndex={-1} className="clipboard-manage__main" onClick={(event) => onClick(index, event)}>
        <ClipboardRowLead entry={entry} kind={kind} />
        <span className="clipboard-popup__text">
          <span className={`clipboard-popup__preview clipboard-manage__preview${entry.masked || kind?.kind === "color" || kind?.kind === "json" ? " clipboard-popup__preview--mono" : ""}`}>{main}</span>
          <span className="clipboard-popup__note">
            {entry.tags?.map((tag) => <span className="clipboard-popup__tag" key={tag}>#{tag}</span>)}
            {meta}
          </span>
        </span>
      </button>
      <span className="clipboard-popup__time clipboard-manage__time">{formatAgo(entry.copiedAt, now, t.common.ago)}</span>
      <button
        type="button"
        tabIndex={-1}
        className={`clipboard-popup__star clipboard-manage__star${entry.favorite ? " clipboard-popup__star--on" : ""}`}
        aria-label={entry.favorite ? text.unfavoriteItem : text.favoriteItem}
        aria-pressed={Boolean(entry.favorite)}
        onClick={() => onToggleFavorite(entry.id)}
      >
        <Star size={13} strokeWidth={2} fill={entry.favorite ? "currentColor" : "none"} />
      </button>
    </li>
  );
});
