import { BookmarkCheck, BookmarkPlus, Settings, X } from "lucide-react";
import { useTranslation } from "../../i18n";
import { openSystemPermission } from "../../lib/system-permissions/api";
import { ClipboardEntryIcon } from "./ClipboardEntryIcon";
import { copyNoticeLabel, copyNoticeThumbnail } from "./copyNotice.ts";
import type { ClipboardCopyCardState } from "./useClipboardCopyCard";
import "./ClipboardCopyNotice.css";

export function ClipboardCopyNotice({ card }: { card: ClipboardCopyCardState }) {
  const t = useTranslation().clipboard;
  if (!card.current) return null;
  const { item, offered, needsAccess } = card.current;
  const label = copyNoticeLabel(item);
  const thumbnail = copyNoticeThumbnail(item);
  const text = needsAccess
    ? t.notice.notPasted
    : card.bookmarkFailed
    ? t.links.failed
    : label.kind === "image"
    ? t.notice.copiedImage
    : label.kind === "files"
    ? t.notice.copiedFiles(label.name, label.more)
    : label.kind === "masked"
    ? t.notice.masked
    : offered
    ? t.links.linkCopied(label.summary)
    : t.notice.copied(label.summary);
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
  const t = useTranslation().clipboard;
  if (!card.current) return null;
  const stop = (run: () => void) => (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    run();
  };
  const bookmarkLabel = card.bookmarked ? t.links.bookmarked : t.links.bookmark;
  const openAccess = () => {
    void openSystemPermission("accessibility").catch((error: unknown) => console.error("Failed to open Accessibility settings", error));
    card.dismiss();
  };
  return (
    <span className="clipboard-copy-notice__actions" onPointerEnter={card.hold} onPointerLeave={card.release}>
      {card.current.needsAccess && (
        <button className="clipboard-copy-notice__action" type="button" aria-label={t.notice.openAccessibility} title={t.notice.openAccessibility} onClick={stop(openAccess)}>
          <Settings size={13} strokeWidth={2} aria-hidden="true" />
        </button>
      )}
      {card.current.link && (
        <button className="clipboard-copy-notice__action" type="button" aria-label={bookmarkLabel} title={bookmarkLabel} aria-pressed={card.bookmarked} disabled={card.bookmarked} onClick={stop(card.bookmark)}>
          {card.bookmarked ? <BookmarkCheck size={13} strokeWidth={2} aria-hidden="true" /> : <BookmarkPlus size={13} strokeWidth={2} aria-hidden="true" />}
        </button>
      )}
      <button className="clipboard-copy-notice__action" type="button" aria-label={t.notice.close} title={t.notice.close} onClick={stop(card.dismiss)}>
        <X size={13} strokeWidth={2} aria-hidden="true" />
      </button>
    </span>
  );
}
