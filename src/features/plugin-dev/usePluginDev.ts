import { useCallback, useEffect, useState } from "react";
import { useErrorText } from "../../i18n";
import {
  getPluginDevState,
  getPluginRpcTrace,
  loadDevPlugin,
  reloadDevPlugin,
  sendPluginDevEvent,
  setPluginDevMode,
  unloadDevPlugin,
  type PluginDevState,
  type PluginTraceEntry,
} from "./api";

const TRACE_REFRESH_MS = 1000;

export function usePluginDev(open: boolean) {
  const errorText = useErrorText();
  const [state, setState] = useState<PluginDevState | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [trace, setTrace] = useState<PluginTraceEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (action: () => Promise<PluginDevState | void>) => {
    setBusy(true);
    try {
      const next = await action();
      if (next) setState(next);
      setError("");
      return true;
    } catch (nextError) {
      setError(errorText(nextError));
      return false;
    } finally {
      setBusy(false);
    }
  }, [errorText]);

  useEffect(() => {
    if (!open) return;
    let didCancel = false;
    const refresh = () =>
      void getPluginDevState()
        .then((next) => !didCancel && setState(next))
        .catch((nextError: unknown) => !didCancel && setError(errorText(nextError)));
    refresh();
    const timer = window.setInterval(refresh, TRACE_REFRESH_MS * 2);
    return () => {
      didCancel = true;
      window.clearInterval(timer);
    };
  }, [errorText, open]);

  const shown = selected && state?.plugins.some((plugin) => plugin.id === selected) ? selected : null;

  useEffect(() => {
    if (!open || !shown) return;
    let didCancel = false;
    const refresh = () =>
      void getPluginRpcTrace(shown)
        .then((next) => !didCancel && setTrace(next))
        .catch(() => undefined);
    refresh();
    const timer = window.setInterval(refresh, TRACE_REFRESH_MS);
    return () => {
      didCancel = true;
      window.clearInterval(timer);
    };
  }, [open, shown]);

  return {
    state,
    selected: shown,
    trace: shown ? trace : [],
    error,
    busy,
    select: setSelected,
    setEnabled: useCallback((enabled: boolean) => void run(() => setPluginDevMode(enabled)), [run]),
    load: useCallback((path: string) => run(() => loadDevPlugin(path)), [run]),
    reload: useCallback((id: string) => void run(() => reloadDevPlugin(id)), [run]),
    unload: useCallback((id: string) => void run(() => unloadDevPlugin(id)), [run]),
    sendEvent: useCallback((id: string, name: string, payload: unknown) => run(() => sendPluginDevEvent(id, name, payload)), [run]),
  };
}
