import { useEffect, useState, type ReactNode } from "react";
import { Copy, ListTodo, NotebookPen, Settings, ShieldCheck, Square, X } from "lucide-react";
import { useErrorText, useTranslation } from "../../i18n";
import { voiceClock } from "./settings";
import type { VoiceInputController } from "./useVoiceInput";
import "./VoiceInputNotice.css";

export type VoiceDraftActions = {
  saveTodo: () => void;
  saveNote: () => void;
  copy: () => void;
  openSettings: () => void;
  openPrivacy: () => void;
  requestFocus: () => void;
};

function Clock({ startedAtMs }: { startedAtMs: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, []);
  return <span className="voice-notice__clock">{voiceClock(now - startedAtMs)}</span>;
}

export function VoiceInputNotice({ voice, actions }: { voice: VoiceInputController; actions: VoiceDraftActions }) {
  const t = useTranslation().voiceInput;
  const errorText = useErrorText();
  const { view } = voice;
  if (!view) return null;
  if (view.kind === "draft") {
    return (
      <span className="voice-notice">
        <input
          className="voice-notice__input"
          value={voice.draft}
          aria-label={t.editLabel}
          title={t.editLabel}
          onPointerDown={(event) => { event.stopPropagation(); actions.requestFocus(); }}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => voice.setDraft(event.target.value)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Escape") voice.dismiss();
            if (event.key === "Enter" && !event.nativeEvent.isComposing) actions.saveTodo();
          }}
        />
      </span>
    );
  }
  const text = view.kind === "recording"
    ? t.listening
    : view.kind === "transcribing"
      ? t.transcribing
      : view.kind === "error"
        ? errorText(view.error)
        : view.text || t.nothingHeard;
  return (
    <span className="voice-notice" role="status">
      {view.kind === "recording" && <span className="voice-notice__dot" aria-hidden="true" />}
      <span className={`voice-notice__text${view.kind === "error" ? " voice-notice__text--error" : ""}`} title={text}>{text}</span>
      {view.kind === "recording" && <Clock startedAtMs={view.startedAtMs} />}
    </span>
  );
}

function Action({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      className="voice-notice__action"
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

export function VoiceInputNoticeActions({ voice, actions }: { voice: VoiceInputController; actions: VoiceDraftActions }) {
  const t = useTranslation().voiceInput;
  const icon = { size: 13, strokeWidth: 2, "aria-hidden": true } as const;
  const { view } = voice;
  if (!view || view.kind === "transcribing") return null;
  if (view.kind === "recording") {
    return (
      <span className="voice-notice__actions">
        <Action label={t.stop} onClick={voice.stop}><Square {...icon} /></Action>
        <Action label={t.cancel} onClick={voice.cancel}><X {...icon} /></Action>
      </span>
    );
  }
  const code = view.kind === "error" ? view.error.code : "";
  return (
    <span className="voice-notice__actions">
      {view.kind === "draft" && voice.draft.trim() && (
        <>
          <Action label={t.saveTodo} onClick={actions.saveTodo}><ListTodo {...icon} /></Action>
          <Action label={t.saveNote} onClick={actions.saveNote}><NotebookPen {...icon} /></Action>
          <Action label={t.copy} onClick={actions.copy}><Copy {...icon} /></Action>
        </>
      )}
      {code === "voiceInput.noModel" && <Action label={t.openSettings} onClick={actions.openSettings}><Settings {...icon} /></Action>}
      {(code === "voiceInput.micDenied" || code === "voiceInput.micFailed") && <Action label={t.openPrivacy} onClick={actions.openPrivacy}><ShieldCheck {...icon} /></Action>}
      <Action label={t.close} onClick={voice.dismiss}><X {...icon} /></Action>
    </span>
  );
}
