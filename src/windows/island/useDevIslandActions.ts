import { useEffect, useRef } from "react";
import { listenDevIslandActions, type DevIslandAction } from "../../features/local-api/api";
import type { IslandPage } from "./types";

type Handlers = {
  openPage: (page: IslandPage) => void;
  collapse: () => void;
  tuck: () => void;
  reveal: () => void;
};

function run(handlers: Handlers, action: DevIslandAction) {
  if (action.action === "open") handlers.openPage(action.page as IslandPage);
  else if (action.action === "collapse") handlers.collapse();
  else if (action.action === "tuck") handlers.tuck();
  else handlers.reveal();
}

export function useDevIslandActions(handlers: Handlers) {
  const latest = useRef(handlers);

  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let unlisten: (() => void) | null = null;
    let cancelled = false;
    void listenDevIslandActions((action) => run(latest.current, action))
      .then((stop) => {
        if (cancelled) stop();
        else unlisten = stop;
      })
      .catch((error) => console.error("Failed to listen for island lab actions", error));
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
}
