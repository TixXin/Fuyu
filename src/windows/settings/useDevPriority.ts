import { useCallback, useEffect, useState } from "react";
import { listenDevPriorityChanged, readDevPriority, saveDevPriority, type DevPriority, type DevPriorityState } from "./api";

export function useDevPriority(active: boolean) {
  const [state, setState] = useState<DevPriorityState | null>(null);

  useEffect(() => {
    if (!active) return;
    let live = true;
    let unlisten: (() => void) | undefined;
    void readDevPriority()
      .then((next) => {
        if (live && next) setState(next);
      })
      .catch((error: unknown) => console.error("Failed to read the development priority", error));
    void listenDevPriorityChanged((next) => {
      if (live) setState(next);
    }).then((stop) => {
      if (live) unlisten = stop;
      else stop();
    }).catch((error: unknown) => console.error("Failed to listen for the development priority", error));
    return () => {
      live = false;
      unlisten?.();
    };
  }, [active]);

  const choose = useCallback((priority: DevPriority) => {
    void saveDevPriority(priority)
      .then((next) => {
        if (next) setState(next);
      })
      .catch((error: unknown) => console.error("Failed to save the development priority", error));
  }, []);

  return [active ? state : null, choose] as const;
}
