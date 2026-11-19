import { useCallback, useEffect, useState } from "react";
import { useErrorText } from "../../i18n";
import { onPluginPackageOpen } from "../../features/plugin-kernel/api";
import type { SettingsCategory } from "./categories";
import { onMarketPackage, onMarketRefreshRequest, setMarketRefreshing } from "./pluginMarketBus";
import { PluginMarketView, type PluginMarketHost } from "./PluginMarketView";
import { consumeBufferedPackage, pullPendingPackage, takeMarketViewRequest, type OpenedPluginPackage } from "./pluginPageHandoff";
import { usePluginHostEnabled, usePluginHostStatus, type PluginHostConnector } from "./usePluginHostStatus";
import { usePluginMarketCatalog } from "./usePluginMarketCatalog";

function useOpenedPackage() {
  const errorText = useErrorText();
  const [openedPackage, setOpenedPackage] = useState<OpenedPluginPackage | null>(null);
  const [openedError, setOpenedError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | null = null;
    const sync = () =>
      void pullPendingPackage(errorText).then(({ pkg, error }) => {
        if (cancelled) return;
        if (pkg) {
          setOpenedError(null);
          setOpenedPackage(pkg);
        } else if (error) setOpenedError(error);
      });
    sync();
    const offOffer = onMarketPackage(sync);
    void onPluginPackageOpen(sync)
      .then((unlisten) => (cancelled ? unlisten() : (stop = unlisten)))
      .catch(() => undefined);
    return () => {
      cancelled = true;
      offOffer();
      stop?.();
    };
  }, [errorText]);
  const consume = useCallback((seq: number) => {
    consumeBufferedPackage(seq);
    setOpenedPackage((prev) => (prev?.seq === seq ? null : prev));
  }, []);
  return { openedPackage, openedError, consume };
}

function ConnectedMarket({ host, onOpenPage }: { host: PluginMarketHost; onOpenPage?: (page: SettingsCategory) => void }) {
  const [request] = useState(takeMarketViewRequest);
  const catalog = usePluginMarketCatalog(host === "open", { fetchWhenEmpty: true });
  const opened = useOpenedPackage();
  const { refresh } = catalog;
  useEffect(() => onMarketRefreshRequest(refresh), [refresh]);
  useEffect(() => {
    setMarketRefreshing(catalog.refreshing);
  }, [catalog.refreshing]);
  useEffect(() => () => setMarketRefreshing(false), []);
  return (
    <PluginMarketView
      host={host}
      snapshot={catalog.snapshot}
      failure={catalog.failure}
      refreshing={catalog.refreshing}
      onRefresh={refresh}
      onReload={catalog.reload}
      onOpenPage={onOpenPage}
      initialQuery={request?.query}
      initialDetail={request?.detail ?? null}
      initialBundle={request?.bundle ?? null}
      openedPackage={opened.openedPackage}
      openedError={opened.openedError}
      onConsumePackage={opened.consume}
    />
  );
}

function HostMarket({ connect, onOpenPage }: { connect?: PluginHostConnector; onOpenPage?: (page: SettingsCategory) => void }) {
  const view = usePluginHostStatus(connect);
  return <ConnectedMarket host={view.connection === "open" ? "open" : view.connection === "closed" ? "off" : "connecting"} onOpenPage={onOpenPage} />;
}

export function PluginMarketPage({ connect, onOpenPage }: { connect?: PluginHostConnector; onOpenPage?: (page: SettingsCategory) => void }) {
  const hostEnabled = usePluginHostEnabled();
  if (hostEnabled === null) return null;
  return hostEnabled ? <HostMarket connect={connect} onOpenPage={onOpenPage} /> : <ConnectedMarket host="off" onOpenPage={onOpenPage} />;
}
