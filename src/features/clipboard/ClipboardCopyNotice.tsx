import { X } from "lucide-react";
import { useTranslation } from "../../i18n";
import { ClipboardEntryIcon } from "./ClipboardEntryIcon";
import { copyNoticeLabel, copyNoticeThumbnail } from "./copyNotice.ts";
import type { ClipboardCopyCardState } from "./useClipboardCopyCard";
import "./ClipboardCopyNotice.css";

export function ClipboardCopyNotice({ card }: { card: ClipboardCopyCardState }) {
  const t = useTranslation().clipboard.notice;
  if (!card.current) return null;
  const { item } = card.current;
  const label = copyNoticeLabel(item);
  const thumbnail = copyNoticeThumbnail(item);
  const text = label.kind === "image"
    ? t.copiedImage
    : label.kind === "files"
    ? t.copiedFiles(label.name, label.more)
    : label.kind === "masked"
    ? t.masked
    : t.copied(label.summary);
  return (
    <span className="clipboard-copy-notice" role="status" data-kind={item.kind} onPointerEnter={card.hold} onPointerLeave={card.release}>
      {thumbnail
        ? <img className="clipboard-copy-notice__thumb" src={thumbnail} alt="" draggable={false} />
        : <ClipboardEntryIcon item={item} className="clipboard-copy-notice__icon" />}
      <span className="clipboard-copy-notice__text">{text}</span>
    </span>
  );
}

export function ClipboardCopyNoticeActions({ card }: { card: ClipboardCopyCardState }) {
  const t = useTranslation().clipboard.notice;
  if (!card.current) return null;
  return (
    <span className="clipboard-copy-notice__actions" onPointerEnter={card.hold} onPointerLeave={card.release}>
      <button
        className="clipboard-copy-notice__action"
        type="button"
        aria-label={t.close}
        title={t.close}
        onClick={(event) => {
          event.stopPropagation();
          card.dismiss();
        }}
      >
        <X size={13} strokeWidth={2} aria-hidden="true" />
      </button>
    </span>
  );
}
