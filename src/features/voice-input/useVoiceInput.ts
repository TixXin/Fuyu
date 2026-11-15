import { useCallback, useEffect, useRef, useState } from "react";
import { cancelVoiceInput, getVoiceInputState, listenVoiceInputState, toggleVoiceInput, type VoiceInputState } from "./api";
import type { NativeError } from "../../i18n/nativeError";

const NOTE_MS = 2600;
const ERROR_MS = 12000;

export type VoiceInputView =
  | { kind: "recording"; startedAtMs: number }
  | { kind: "transcribing" }
  | { kind: "draft" }
  | { kind: "note"; text: string }
  | { kind: "error"; error: NativeError };

function logError(error: unknown) {
  console.error("Voice input failed", error);
}

export function useVoiceInput() {
  const [view, setView] = useState<VoiceInputView | null>(null);
  const [draft, setDraft] = useState("");
  const timer = useRef(0);

  const dismiss = useCallback(() => {
    window.clearTimeout(timer.current);
    setView(null);
  }, []);

  const flash = useCallback((next: VoiceInputView, ms: number) => {
    window.clearTimeout(timer.current);
    setView(next);
    timer.current = window.setTimeout(() => setView(null), ms);
  }, []);

  const apply = useCallback((state: VoiceInputState) => {
    window.clearTimeout(timer.current);
    if (state.phase === "recording") setView({ kind: "recording", startedAtMs: state.startedAtMs });
    else if (state.phase === "transcribing") setView({ kind: "transcribing" });
    else if (state.phase === "failed") flash({ kind: "error", error: state.error }, ERROR_MS);
    else if (state.phase === "result" && state.text.trim()) {
      setDraft(state.text);
      setView({ kind: "draft" });
    } else if (state.phase === "result") flash({ kind: "note", text: "" }, NOTE_MS);
    else setView((current) => (current?.kind === "recording" || current?.kind === "transcribing" ? null : current));
  }, [flash]);

  const latestApply = useRef(apply);
  useEffect(() => { latestApply.current = apply; });

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | null = null;
    void listenVoiceInputState((event) => latestApply.current(event.payload))
      .then((unlisten) => {
        if (cancelled) unlisten();
        else stop = unlisten;
      })
      .catch(logError);
    getVoiceInputState()
      .then((state) => { if (!cancelled && state.phase !== "idle") latestApply.current(state); })
      .catch(logError);
    return () => {
      cancelled = true;
      stop?.();
      window.clearTimeout(timer.current);
    };
  }, []);

  const stop = useCallback(() => { void toggleVoiceInput().catch(logError); }, []);
  const cancel = useCallback(() => { void cancelVoiceInput().catch(logError); }, []);
  const notify = useCallback((text: string) => flash({ kind: "note", text }, NOTE_MS), [flash]);

  return { view, draft, setDraft, dismiss, stop, cancel, notify };
}

export type VoiceInputController = ReturnType<typeof useVoiceInput>;
