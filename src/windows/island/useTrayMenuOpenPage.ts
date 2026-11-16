import { useEffect, useRef } from "react";
import { listenTrayMenuOpenPage } from "./api";
import { trayMenuIslandPage } from "./trayMenuPage";
import type { IslandPage } from "./types";

export function useTrayMenuOpenPage(openEnabledPage: (page: IslandPage) => void) {
  const latest = useRef(openEnabledPage);

  useEffect(() => {
    latest.current = openEnabledPage;
  });

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let cancelled = false;
    void listenTrayMenuOpenPage((page) => {
      const target = trayMenuIslandPage(page);
      if (target) latest.current(target);
    })
      .then((stop) => {
        if (cancelled) stop();
        else unlisten = stop;
      })
      .catch((error: unknown) => console.error("Failed to listen for tray card pages", error));
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
}
