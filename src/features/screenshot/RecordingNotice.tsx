import { FolderOpen, Inbox, Pause, Play, Square, X } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "../../i18n";
import type { RecordingNoticeState } from "./useRecording";
import "./ScreenshotNotice.css";
import "./RecordingNotice.css";

export function RecordingNotice({ recording }: { recording: RecordingNoticeState }) {
  const { live } = recording;
  if (!recording.shown) return null;
  const dot = live ? `recording-notice__dot${live.paused || live.phase === "countdown" ? " recording-notice__dot--still" : " recording-notice__dot--live"}` : null;
  return (
    <span className="screenshot-notice recording-notice" role="status" onPointerEnter={recording.hold} onPointerLeave={live ? undefined : recording.release}>
      {dot && <span className={dot} aria-hidden="true" />}
      <span className="screenshot-notice__text recording-notice__text">{recording.text}</span>
    </span>
  );
}

function Action({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      className="screenshot-notice__action"
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

export function RecordingNoticeActions({ recording }: { recording: RecordingNoticeState }) {
  const t = useTranslation().screenshot.recording;
  const { live, finished } = recording;
  const icon = { size: 13, strokeWidth: 2, "aria-hidden": true } as const;
  if (live?.phase === "countdown") {
    return (
      <span className="screenshot-notice__actions">
        <Action label={t.cancel} onClick={recording.stop}><X {...icon} /></Action>
      </span>
    );
  }
  if (live) {
    return (
      <span className="screenshot-notice__actions">
        <Action label={live.paused ? t.resume : t.pause} onClick={recording.togglePause}>
          {live.paused ? <Play {...icon} /> : <Pause {...icon} />}
        </Action>
        <Action label={t.stop} onClick={recording.stop}><Square {...icon} /></Action>
      </span>
    );
  }
  if (!finished) return null;
  return (
    <span className="screenshot-notice__actions" onPointerEnter={recording.hold} onPointerLeave={recording.release}>
      {finished.summary && <Action label={t.reveal} onClick={recording.reveal}><FolderOpen {...icon} /></Action>}
      {finished.summary && <Action label={t.shelve} onClick={recording.shelve}><Inbox {...icon} /></Action>}
      <Action label={t.close} onClick={recording.dismiss}><X {...icon} /></Action>
    </span>
  );
}
