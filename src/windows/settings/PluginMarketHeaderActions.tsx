import { useSyncExternalStore } from "react";
import { RefreshCw, Upload } from "lucide-react";
import { useTranslation } from "../../i18n";
import { usePluginFilePicker } from "./PluginPageActions";
import { announceMarketPackage, isMarketRefreshing, requestMarketRefresh, watchMarketRefreshing } from "./pluginMarketBus";
import "./PluginPage.css";

export function PluginMarketHeaderActions() {
  const text = useTranslation().settings.pluginsV3.marketPage;
  const refreshing = useSyncExternalStore(watchMarketRefreshing, isMarketRefreshing);
  const file = usePluginFilePicker(announceMarketPackage);
  const refreshLabel = refreshing ? text.refreshing : text.refresh;
  return (
    <div className="plugin-page__actions">
      <button className="plugin-icon-btn plugin-icon-btn--outlined" type="button" title={refreshLabel} aria-label={refreshLabel} disabled={refreshing} data-action="market-refresh" onClick={requestMarketRefresh}>
        <RefreshCw className={refreshing ? "plugin-spin" : undefined} size={14} strokeWidth={2.2} aria-hidden="true" />
      </button>
      <button className="plugin-btn" type="button" title={text.installFromFile} data-action="market-install-file" onClick={file.pick}>
        <Upload size={14} strokeWidth={2.2} aria-hidden="true" />
        <span className="plugin-page__action-label">{text.installFromFile}</span>
      </button>
      {file.input}
    </div>
  );
}
