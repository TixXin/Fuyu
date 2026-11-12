import { useCallback, useEffect, useRef, useState } from "react";
import { listenPluginViewChanged, listPluginViews, type PluginStatusEntry, type PluginStatusItemEntry, type PluginViewEntry, type PluginViewsSnapshot } from "./api";

type Part = "views" | "status" | "statusItems";

function usePluginViewsPart<K extends Part>(part: K): PluginViewsSnapshot[K] {
  const [value, setValue] = useState<PluginViewsSnapshot[K]>([] as PluginViewsSnapshot[K]);
  const lastText = useRef("[]");

  const refresh = useCallback(() => {
    listPluginViews()
      .then((snapshot) => {
        const next = snapshot[part] ?? ([] as PluginViewsSnapshot[K]);
        const text = JSON.stringify(next);
        if (text === lastText.current) return;
        lastText.current = text;
        setValue(next);
      })
      .catch((error: unknown) => console.error("Failed to list plugin views", error));
  }, [part]);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    refresh();
    void listenPluginViewChanged((change) => {
      if (change.kind === "reset" || (part === "status" && change.kind === "status")) refresh();
    })
      .then((stop) => {
        if (cancelled) stop();
        else unlisten = stop;
      })
      .catch((error: unknown) => console.error("Failed to listen for plugin view changes", error));
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [part, refresh]);

  return value;
}

export function usePluginViews(): PluginViewEntry[] {
  return usePluginViewsPart("views");
}

export function usePluginStatus(): PluginStatusEntry[] {
  return usePluginViewsPart("status");
}

export function usePluginStatusItemList(): PluginStatusItemEntry[] {
  return usePluginViewsPart("statusItems");
}
