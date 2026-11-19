import { useCallback, useEffect, useState } from "react";
import type { MarketCatalogSnapshot } from "@fuyu/plugin-services";
import { windowServices } from "../../features/plugin-kernel/services";
import { useErrorText } from "../../i18n";
import { marketClient } from "./pluginMarketActions";

export interface PluginMarketCatalog {
  snapshot: MarketCatalogSnapshot | null;
  failure: string | null;
  refreshing: boolean;
  reload: () => void;
  refresh: () => void;
  replace: (next: MarketCatalogSnapshot) => void;
}

export function usePluginMarketCatalog(connected: boolean): PluginMarketCatalog {
  const errorText = useErrorText();
  const [snapshot, setSnapshot] = useState<MarketCatalogSnapshot | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const reload = useCallback(() => {
    if (!connected) return;
    void marketClient
      .catalog()
      .then((next) => {
        setSnapshot(next);
        setFailure(null);
      })
      .catch((error: unknown) => setFailure(errorText(error)));
  }, [connected, errorText]);
  const refresh = useCallback(() => {
    if (!connected) return;
    setRefreshing(true);
    void marketClient
      .refresh()
      .then((next) => {
        setSnapshot(next);
        setFailure(null);
      })
      .catch((error: unknown) => setFailure(errorText(error)))
      .finally(() => setRefreshing(false));
  }, [connected, errorText]);
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
  return { snapshot, failure, refreshing, reload, refresh, replace: setSnapshot };
}
