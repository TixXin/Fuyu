import { useCallback, useEffect, useState } from "react";
import { useErrorText, useTranslation } from "../../i18n";
import { onPluginPackageOpen } from "../../features/plugin-kernel/api";
import type { SettingsCategory } from "./categories";
import { PluginMarketV3Tab } from "./PluginMarketV3Tab";
import { consumeBufferedPackage, pullPendingPackage, requestPluginDetail, takeMarketViewRequest, type OpenedPluginPackage } from "./pluginPageHandoff";
import { PluginSearchInput } from "./PluginSearchInput";
import { usePluginHostEnabled, usePluginHostStatus, type PluginHostConnector } from "./usePluginHostStatus";
import "./PluginPage.css";
import "./PluginsV3SettingsPage.css";

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
    void onPluginPackageOpen(sync)
      .then((unlisten) => (cancelled ? unlisten() : (stop = unlisten)))
      .catch(() => undefined);
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [errorText]);
  const consume = useCallback((seq: number) => {
    consumeBufferedPackage(seq);
    setOpenedPackage((prev) => (prev?.seq === seq ? null : prev));
  }, []);
  return { openedPackage, openedError, consume };
}

export function PluginMarketView({ connected, onOpenPage }: { connected: boolean; onOpenPage?: (page: SettingsCategory) => void }) {
  const text = useTranslation().settings.pluginsV3;
  const [request] = useState(takeMarketViewRequest);
  const [query, setQuery] = useState(request?.query ?? "");
  const opened = useOpenedPackage();
  return (
    <div className="plugin-page plugins-v3" data-market-page>
      <div className="plugin-page__toolbar">
        <PluginSearchInput query={query} placeholder={text.searchPlaceholder} clearLabel={text.clearSearch} onChange={setQuery} />
      </div>
      <PluginMarketV3Tab
        connected={connected}
        query={query}
        openedPackage={opened.openedPackage}
        openedError={opened.openedError}
        onConsumeOpenedPackage={opened.consume}
        initialDetail={request?.detail ?? null}
        onManage={
          onOpenPage
            ? (name) => {
                requestPluginDetail(name);
                onOpenPage("pluginsV3");
              }
            : undefined
        }
      />
    </div>
  );
}

function ConnectedMarket({ connect, onOpenPage }: { connect?: PluginHostConnector; onOpenPage?: (page: SettingsCategory) => void }) {
  const view = usePluginHostStatus(connect);
  return <PluginMarketView connected={view.connection === "open"} onOpenPage={onOpenPage} />;
}

export function PluginMarketPage({ connect, onOpenPage }: { connect?: PluginHostConnector; onOpenPage?: (page: SettingsCategory) => void }) {
  const hostEnabled = usePluginHostEnabled();
  if (hostEnabled === null) return null;
  return hostEnabled ? <ConnectedMarket connect={connect} onOpenPage={onOpenPage} /> : <PluginMarketView connected={false} onOpenPage={onOpenPage} />;
}
