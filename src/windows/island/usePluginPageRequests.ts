import { useEffect, useRef } from "react";
import { listenIslandPluginPageRequest } from "../../features/plugin-kernel/api";
import { pluginIslandPage } from "../../features/plugin-kernel/islandPageRequest";
import { islandWindowVisible, showReadyIsland, takeIslandClickFocus } from "./api";
import { pageSlot } from "./slots/pageSlot";
import type { IslandPage } from "./types";

export async function showIfHidden() {
  const visible = await islandWindowVisible().catch(() => true);
  if (!visible) await showReadyIsland();
}

export function usePluginPageRequests(openEnabledPage: (page: IslandPage) => void) {
  const latest = useRef(openEnabledPage);

  useEffect(() => {
    latest.current = openEnabledPage;
  });

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let cancelled = false;
    void listenIslandPluginPageRequest((request) => {
      const page = pluginIslandPage(request, pageSlot.items());
      if (!page) return console.warn(`Asked to open ${request.pluginId} on the island, but it has no island page${request.page ? ` called ${request.page}` : ""} right now`);
      void showIfHidden()
        .then(() => {
          latest.current(page);
          return takeIslandClickFocus();
        })
        .catch((error: unknown) => console.error("Failed to open a plugin page on the island", error));
    })
      .then((stop) => {
        if (cancelled) stop();
        else unlisten = stop;
      })
      .catch((error: unknown) => console.error("Failed to listen for plugin page requests", error));
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
}
