import { useEffect, useState } from "react";
import { listenPluginViewChanged, setPluginViewVisible } from "./api";

export function usePluginViewModel(pluginId: string, viewId: string, shown: boolean) {
  const [model, setModel] = useState<unknown>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!shown) return;
    let alive = true;
    let unlisten: (() => void) | undefined;
    void listenPluginViewChanged((change) => {
      if (alive && change.kind === "view" && change.pluginId === pluginId && change.viewId === viewId) setModel(change.model);
    })
      .then((stop) => {
        if (alive) unlisten = stop;
        else stop();
      })
      .catch((error: unknown) => console.error("Failed to listen for a plugin view", error));
    setPluginViewVisible(pluginId, viewId, true)
      .then((current) => {
        if (!alive) return;
        setModel(current ?? null);
        setLoaded(true);
      })
      .catch((error: unknown) => console.error("Failed to show a plugin view", error));
    return () => {
      alive = false;
      unlisten?.();
      setLoaded(false);
      setModel(null);
      void setPluginViewVisible(pluginId, viewId, false).catch(() => undefined);
    };
  }, [pluginId, shown, viewId]);

  return { model, loaded };
}
