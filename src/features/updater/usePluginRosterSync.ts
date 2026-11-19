import { useEffect } from "react";
import { marketV1, pluginConfigV1 } from "@fuyu/plugin-services";
import { loadRoster, loadRosterLocal, saveRoster, saveRosterLocal } from "../../lib/plugin-roster/storage";
import { visibilityInterval } from "../../lib/useVisibilityInterval";
import { windowServices } from "../plugin-kernel/services";
import { createRosterSync } from "./pluginRosterSync";

const market = windowServices.get(marketV1);
const pluginConfig = windowServices.get(pluginConfigV1);

const CHECK_MS = 5 * 60 * 1000;

export function usePluginRosterSync() {
  useEffect(() => {
    const sync = createRosterSync({
      installed: async () => (await market.catalog()).installed,
      config: async (id) => (await pluginConfig.get({ id })).values,
      loadRoster,
      saveRoster,
      loadLocal: loadRosterLocal,
      saveLocal: saveRosterLocal,
    });
    const run = () => void sync.run();
    run();
    const offWatch = windowServices.watch(run);
    const offMarket = market.on("changed", run);
    const offConfig = pluginConfig.on("changed", run);
    const stopTimer = visibilityInterval(run, CHECK_MS);
    return () => {
      offWatch();
      void offMarket();
      void offConfig();
      stopTimer();
    };
  }, []);
}
