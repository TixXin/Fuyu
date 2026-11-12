import { CornerDownLeft, Pause } from "lucide-react";
import { useTranslation } from "../../i18n";
import type { ClipboardCaptureStatus } from "./api";

export type MergeSeparator = "newline" | "space" | "comma";
const SEPARATORS: readonly MergeSeparator[] = ["newline", "space", "comma"];

const Enter = () => <CornerDownLeft size={10} strokeWidth={2.4} />;

export function pausedNow(capture: ClipboardCaptureStatus | undefined, now: number) {
  return Boolean(capture?.paused && !(capture.pausedUntil && now >= capture.pausedUntil));
}

export function ClipboardPauseBar({ capture, now, onResume }: { capture?: ClipboardCaptureStatus; now: number; onResume: () => void }) {
  const text = useTranslation().clipboard.popup.actions;
  const paused = pausedNow(capture, now);
  if (!paused && !capture?.ignoreNext) return null;
  const label = !paused
    ? text.ignoringNext
    : capture?.pausedUntil
      ? text.pausedUntil(Math.max(1, Math.ceil((capture.pausedUntil - now) / 60_000)))
      : text.pausedOpen;
  return (
    <div className="clipboard-popup__pausebar" role="status">
      <Pause size={12} strokeWidth={2.4} aria-hidden="true" />
      <span>{label}</span>
      <button type="button" tabIndex={-1} onClick={onResume}>{text.resumeNow}</button>
    </div>
  );
}

export function ClipboardPopupFooter({ onSnippets, wide, queued, separator, onSeparator, deleted, onUndo, notice, capture, now, onToggleRecord }: {
  onSnippets: boolean;
  wide: boolean;
  queued: number;
  separator: MergeSeparator;
  onSeparator: (separator: MergeSeparator) => void;
  deleted: string | null;
  onUndo: () => void;
  notice: string | null;
  capture?: ClipboardCaptureStatus;
  now: number;
  onToggleRecord: () => void;
}) {
  const t = useTranslation();
  const popup = t.clipboard.popup;
  const text = popup.actions;
  if (queued > 0) {
    return (
      <footer className="clipboard-popup__hint clipboard-popup__hint--sequence" role="status">
        <span>{popup.sequenceCount(queued)} · <kbd><Enter /></kbd>{popup.sequenceStart}</span>
        <span>
          <kbd>Ctrl <Enter /></kbd>{text.merge}
          <button
            type="button"
            tabIndex={-1}
            className="clipboard-popup__separator"
            onClick={() => onSeparator(SEPARATORS[(SEPARATORS.indexOf(separator) + 1) % SEPARATORS.length])}
          >
            {text.mergeSeparator[separator]} ▾
          </button>
        </span>
        <span className="clipboard-popup__hint-end"><kbd>Esc</kbd>{popup.cancel}</span>
      </footer>
    );
  }
  if (deleted !== null) {
    return (
      <footer className="clipboard-popup__hint clipboard-popup__hint--toast" role="status">
        <span className="clipboard-popup__toast-text">{text.deleted(deleted)}</span>
        <button type="button" tabIndex={-1} className="clipboard-popup__hint-end clipboard-popup__undo" onClick={onUndo}>
          <kbd>Ctrl Z</kbd>{text.undo}
        </button>
      </footer>
    );
  }
  const paused = pausedNow(capture, now);
  return (
    <footer className="clipboard-popup__hint">
      {notice ? (
        <span className="clipboard-popup__toast-text" role="status">{notice}</span>
      ) : (
        <>
          <span><kbd><Enter /></kbd>{popup.paste}</span>
          {!onSnippets && wide && <span><kbd>⇧<Enter /></kbd>{popup.plain}</span>}
          <span><kbd>Ctrl K</kbd>{text.more}</span>
          {!onSnippets && !wide && <span><kbd>{text.spaceKey}</kbd>{text.preview}</span>}
          {!onSnippets && wide && <span><kbd>Ctrl</kbd>{popup.pickSequence}</span>}
        </>
      )}
      <button
        type="button"
        tabIndex={-1}
        className={`clipboard-popup__hint-end clipboard-popup__record${paused ? " clipboard-popup__record--off" : ""}`}
        aria-pressed={!paused}
        onClick={onToggleRecord}
      >
        <i aria-hidden="true" />{paused ? text.paused : text.recording}
      </button>
      <span><kbd>Esc</kbd></span>
    </footer>
  );
}
