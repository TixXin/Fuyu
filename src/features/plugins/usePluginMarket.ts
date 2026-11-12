import { useCallback, useEffect, useState } from "react";
import { useErrorText } from "../../i18n";
import {
  getCachedPluginMarket,
  getPluginMarket,
  installMarketPlugin,
  marketPublisher,
  setPluginPublisherTrusted,
  type MarketSnapshot,
  type PluginsSnapshot,
} from "./api";

let lastMarket: MarketSnapshot | null = null;
let lastLoadedAt: number | null = null;

export function usePluginMarket(onInstalled?: (snapshot: PluginsSnapshot) => void) {
  const errorText = useErrorText();
  const [market, setMarket] = useState<MarketSnapshot | null>(lastMarket);
  useEffect(() => {
    lastMarket = market;
  }, [market]);
  const [loadedAt, setLoadedAt] = useState<number | null>(lastLoadedAt);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [installError, setInstallError] = useState<{ id: string; detail: string } | null>(null);
  const [installingId, setInstallingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoadError("");
    setInstallError(null);
    setLoading(true);
    try {
      setMarket(await getPluginMarket());
      lastLoadedAt = Date.now();
      setLoadedAt(lastLoadedAt);
    } catch (nextError) {
      setLoadError(errorText(nextError));
    } finally {
      setLoading(false);
    }
  }, [errorText]);

  useEffect(() => {
    if (lastMarket === null) {
      getCachedPluginMarket()
        .then((cached) => cached && setMarket((current) => current ?? cached))
        .catch(() => undefined);
    }
    void refresh();
  }, [refresh]);

  const install = useCallback(
    async (id: string, trust = false, acceptKeyChange = false) => {
      setInstallingId(id);
      setInstallError(null);
      try {
        const plugin = market?.plugins.find((item) => item.id === id);
        if (trust && plugin && market) {
          const publisher = marketPublisher(plugin, market);
          await setPluginPublisherTrusted(publisher, true);
          setMarket((current) => current && { ...current, trustedPublishers: [...current.trustedPublishers, publisher] });
        }
        const installed = await installMarketPlugin(id, acceptKeyChange);
        onInstalled?.(installed);
        setMarket((current) =>
          current && {
            ...current,
            plugins: current.plugins.map((item) => (item.id === id ? { ...item, installedVersion: item.version, signingKeyChanged: false } : item)),
          },
        );
      } catch (nextError) {
        setInstallError({ id, detail: errorText(nextError) });
      } finally {
        setInstallingId(null);
      }
    },
    [errorText, market, onInstalled],
  );

  return { market, loadedAt, loading, loadError, installError, installingId, refresh, install };
}
