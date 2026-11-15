import { useCallback, useEffect, useState } from "react";
import {
  cancelVoiceModelDownload,
  deleteVoiceModel,
  downloadVoiceModel,
  getVoiceModelStatus,
  listenVoiceModelProgress,
  type VoiceModelProgress,
  type VoiceModelStatus,
} from "./api";

export function useVoiceModel() {
  const [status, setStatus] = useState<VoiceModelStatus | null>(null);
  const [progress, setProgress] = useState<VoiceModelProgress | null>(null);
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(() => {
    getVoiceModelStatus().then(setStatus).catch(setError);
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | null = null;
    void listenVoiceModelProgress((event) => {
      if (event.payload.stage === "done") {
        setProgress(null);
        refresh();
      } else {
        setProgress(event.payload);
      }
    }).then((unlisten) => {
      if (cancelled) unlisten();
      else stop = unlisten;
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [refresh]);

  const download = useCallback(() => {
    setError(null);
    setStatus((current) => current && { ...current, downloading: true });
    downloadVoiceModel()
      .then(setStatus)
      .catch((reason: unknown) => {
        setError(reason);
        refresh();
      });
  }, [refresh]);

  const cancel = useCallback(() => {
    void cancelVoiceModelDownload().catch(setError);
  }, []);

  const remove = useCallback(() => {
    setError(null);
    deleteVoiceModel().then(setStatus).catch(setError);
  }, []);

  return { status, progress, error, download, cancel, remove };
}
