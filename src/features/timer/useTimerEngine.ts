import { useEffect } from "react";
import { timersV1 } from "@fuyu/plugin-services";
import { getPluginHostConnection } from "../plugin-kernel/api.ts";
import { pluginRuntime } from "../plugin-kernel/runtime.ts";
import { windowServices } from "../plugin-kernel/services.ts";
import { listenTimerShortcut } from "./api.ts";
import { provideLocalTimers } from "./localTimers.ts";
import { configureTimers, requestTimerPage } from "./store.ts";
import { useTimerConfig } from "./useTimerConfig.ts";

export function useTimerEngine() {
  const [{ sound }] = useTimerConfig();

  useEffect(() => {
    configureTimers(true, sound);
  }, [sound]);

  useEffect(() => () => configureTimers(false, true), []);

  useEffect(() => {
    let disposed = false;
    let stopFallback: (() => void) | null = null;
    void getPluginHostConnection()
      .then((connection) => {
        if (disposed) return;
        if (connection?.enabled) {
          void pluginRuntime("island");
          return;
        }
        if (!windowServices.has(timersV1.name)) stopFallback = provideLocalTimers(windowServices);
      })
      .catch(() => {
        if (!disposed && !windowServices.has(timersV1.name)) stopFallback = provideLocalTimers(windowServices);
      });
    return () => {
      disposed = true;
      stopFallback?.();
    };
  }, []);

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
