import { useCallback, useEffect, useRef, useState } from "react";
import { addFileShelfPaths } from "../file-shelf/api";
import { useErrorText, useTranslation } from "../../i18n";
import {
  getRecordingStatus,
  listenRecordingFinished,
  listenRecordingState,
  pauseRecording,
  revealRecording,
  stopRecording,
  type RecordingFinished,
  type RecordingState,
} from "./api";
import { clockTime, elapsedOf } from "./recordingTime";

const FINISHED_SECONDS = 8;

export function useRecording() {
  const t = useTranslation().screenshot.recording;
  const errorText = useErrorText();
  const [state, setState] = useState<RecordingState | null>(null);
  const [finished, setFinished] = useState<RecordingFinished | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const timer = useRef(0);

  const dismiss = useCallback(() => {
    window.clearTimeout(timer.current);
    setFinished(null);
    setMessage(null);
  }, []);
  const release = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(dismiss, FINISHED_SECONDS * 1000);
  }, [dismiss]);
  const hold = useCallback(() => window.clearTimeout(timer.current), []);

  useEffect(() => {
    let cancelled = false;
    const stops: (() => void)[] = [];
    const keep = (stop: () => void) => (cancelled ? stop() : stops.push(stop));
    void listenRecordingState((event) => {
      setState(event.payload);
      setNow(Date.now());
    }).then(keep);
    void listenRecordingFinished((event) => {
      setMessage(null);
      setFinished(event.payload);
      release();
    }).then(keep);
    getRecordingStatus()
      .then((current) => { if (!cancelled) setState(current); })
      .catch(() => {});
    return () => {
      cancelled = true;
      stops.forEach((stop) => stop());
      window.clearTimeout(timer.current);
    };
  }, [release]);

  const running = state?.phase === "recording" && !state.paused;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [running]);

  const report = (error: unknown) => setMessage(errorText(error));
  const live = state && state.phase !== "idle" ? state : null;
  const time = clockTime(elapsedOf(live, now));
  const summary = finished?.summary ?? null;

  let text = "";
  if (live?.phase === "countdown") text = t.countdown(live.countdown);
  else if (live) text = live.paused ? t.paused(time) : t.running(time);
  else if (finished) text = message ?? (summary ? t.saved(clockTime(summary.seconds * 1000)) : errorText(finished.error));

  return {
    live,
    finished: live ? null : finished,
    shown: live !== null || finished !== null,
    text,
    togglePause: () => live && void pauseRecording(!live.paused).catch(report),
    stop: () => void stopRecording().catch(report),
    reveal: () => summary && void revealRecording(summary.path).catch(report),
    shelve: () => summary && void addFileShelfPaths([summary.path]).then(() => setMessage(t.shelved), report),
    dismiss,
    hold,
    release,
  };
}

export type RecordingNoticeState = ReturnType<typeof useRecording>;
