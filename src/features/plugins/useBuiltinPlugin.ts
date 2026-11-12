import { useEffect, useState } from "react";
import { listPlugins } from "./api";
import { listenPluginViewChanged } from "../plugin-views/api";
import { BUILTIN_PLUGIN_OFF, builtinPluginState, type BuiltinPluginState } from "./builtinPlugin";

export function useBuiltinPlugin(id: string): BuiltinPluginState {
  const [state, setState] = useState<BuiltinPluginState>(BUILTIN_PLUGIN_OFF);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    let lastText = "";
    const refresh = () => {
      listPlugins()
        .then((snapshot) => {
          const next = builtinPluginState(snapshot, id);
          const text = JSON.stringify(next);
          if (cancelled || text === lastText) return;
          lastText = text;
          setState(next);
        })
        .catch((error: unknown) => console.error(`Failed to read built-in plugin ${id}`, error));
    };
    refresh();
    void listenPluginViewChanged((change) => {
      if (change.kind === "reset" && change.pluginId === id) refresh();
    })
      .then((stop) => {
        if (cancelled) {
          stop();
          return;
        }
        unlisten = stop;
        refresh();
      })
      .catch((error: unknown) => console.error("Failed to listen for plugin changes", error));
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [id]);

  return state;
}
