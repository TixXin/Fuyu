import { useCallback, useEffect, useState } from "react";
import type { MarketCatalogSnapshot } from "@fuyu/plugin-services";
import { windowServices } from "../../features/plugin-kernel/services";
import { marketClient } from "./pluginMarketActions";

export interface PluginMarketCatalog {
  snapshot: MarketCatalogSnapshot | null;
  reload: () => void;
  replace: (next: MarketCatalogSnapshot) => void;
}

export function usePluginMarketCatalog(connected: boolean): PluginMarketCatalog {
  const [snapshot, setSnapshot] = useState<MarketCatalogSnapshot | null>(null);
  const reload = useCallback(() => {
    if (!connected) return;
    void marketClient.catalog().then(setSnapshot).catch(() => undefined);
  }, [connected]);
  useEffect(() => {
    if (!connected) return;
    reload();
    const offWatch = windowServices.watch(reload);
    const offChanged = marketClient.on("changed", reload);
    return () => {
      offWatch();
      void offChanged();
    };
  }, [connected, reload]);
  return { snapshot, reload, replace: setSnapshot };
}
