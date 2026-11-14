import { BellRing, Plus, X } from "lucide-react";
import { useTranslation } from "../../i18n";
import { dismissRinging, extendRinging } from "./store";
import { clockText, type Timer } from "./timers";
import "../screenshot/ScreenshotNotice.css";

export function TimerNotice({ ringing }: { ringing: readonly Timer[] }) {
  const t = useTranslation().timer;
  const first = ringing[0];
  if (!first) return null;
  const text = t.timeUp(clockText(first.durationMs, true));
  return (
    <span className="screenshot-notice timer-notice" role="alert">
      <BellRing size={14} strokeWidth={2.2} aria-hidden="true" />
      <span className="screenshot-notice__text">{ringing.length > 1 ? `${text} · ${t.moreUp(ringing.length - 1)}` : text}</span>
    </span>
  );
}

export function TimerNoticeActions() {
  const t = useTranslation().timer;
  const stop = (run: () => void) => (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    run();
  };
  return (
    <span className="screenshot-notice__actions">
      <button className="screenshot-notice__action" type="button" aria-label={t.extend} title={t.extend} onClick={stop(extendRinging)}>
        <Plus size={13} strokeWidth={2} aria-hidden="true" />
      </button>
      <button className="screenshot-notice__action" type="button" aria-label={t.dismiss} title={t.dismiss} onClick={stop(dismissRinging)}>
        <X size={13} strokeWidth={2} aria-hidden="true" />
      </button>
    </span>
  );
}
