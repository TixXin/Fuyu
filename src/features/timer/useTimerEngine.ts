import { useEffect } from "react";
import { listenTimerShortcut } from "./api";
import { configureTimers, requestTimerPage } from "./store";
import { useTimerConfig } from "./useTimerConfig";

export function useTimerEngine() {
  const [{ sound }] = useTimerConfig();

  useEffect(() => {
    configureTimers(true, sound);
  }, [sound]);

  useEffect(() => () => configureTimers(false, true), []);

  useEffect(() => {
    let disposed = false;
    let stop: (() => void) | null = null;
    void listenTimerShortcut(() => requestTimerPage(true))
      .then((unlisten) => {
        if (disposed) unlisten();
        else stop = unlisten;
      })
      .catch((error: unknown) => console.error("Failed to listen for the timer shortcut", error));
    return () => {
      disposed = true;
      stop?.();
    };
  }, []);
}
