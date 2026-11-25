import { X } from "lucide-react";
import { useTranslation } from "../../i18n";
import type { DelayNoticeState } from "./useDelayedScreenshot";
import "./ScreenshotNotice.css";
import "./RecordingNotice.css";

export function DelayNotice({ delay }: { delay: DelayNoticeState }) {
  if (!delay.active) return null;
  return (
    <span className="screenshot-notice recording-notice" role="status">
      <span className="recording-notice__dot recording-notice__dot--still" aria-hidden="true" />
      <span className="screenshot-notice__text recording-notice__text">{delay.text}</span>
    </span>
  );
}

export function DelayNoticeActions({ delay }: { delay: DelayNoticeState }) {
  const t = useTranslation().screenshot.delay;
  if (!delay.active) return null;
  return (
    <span className="screenshot-notice__actions">
      <button
        className="screenshot-notice__action"
        type="button"
        aria-label={t.cancel}
        title={t.cancel}
        onClick={(event) => {
          event.stopPropagation();
          delay.cancel();
        }}
      >
        <X size={13} strokeWidth={2} aria-hidden="true" />
      </button>
    </span>
  );
}
