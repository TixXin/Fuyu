import { useEffect, useRef } from "react";
import { islandRefusal, setLocalIslandControl } from "../../features/plugin-kernel/islandControl";
import { ownIslandPage, showsOwnIslandPage } from "../../features/plugin-kernel/islandPageRequest";
import { takeIslandClickFocus } from "./api";
import { pageSlot } from "./slots/pageSlot";
import type { IslandMode, IslandPage } from "./types";
import { showIfHidden } from "./usePluginPageRequests";

type IslandControlState = {
  mode: IslandMode;
  page: IslandPage;
  openEnabledPage: (page: IslandPage) => void;
  collapseIsland: () => void;
};

export function usePluginIslandControl(state: IslandControlState) {
  const latest = useRef(state);

  useEffect(() => {
    latest.current = state;
  });

  useEffect(
    () =>
      setLocalIslandControl({
        open: async (plugin, page) => {
          const found = ownIslandPage(plugin, page, pageSlot.items());
          if ("refusal" in found) throw islandRefusal(found.refusal, plugin, page);
          await showIfHidden();
          latest.current.openEnabledPage(found.page);
          await takeIslandClickFocus();
        },
        collapse: async (plugin) => {
          const { mode, page, collapseIsland } = latest.current;
          if (!showsOwnIslandPage(plugin, { mode, page }, pageSlot.items())) return false;
          collapseIsland();
          return true;
        },
      }),
    [],
  );
}
