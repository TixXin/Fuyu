import { PluginUpdatesSection } from "./PluginUpdatesSection";
import { usePlugins } from "./usePlugins";
import "./PluginsSettingsSection.css";

export function PluginUpdatesTab() {
  const { snapshot, error, busy, pending, notice, setAutoUpdate, untrustPublisher, checkUpdates } = usePlugins();
  if (!snapshot) return error ? <p className="plugin-card__error">{error}</p> : null;
  return (
    <>
      <PluginUpdatesSection snapshot={snapshot} busy={busy} pending={pending} notice={notice} onAutoUpdateChange={setAutoUpdate} onCheck={checkUpdates} onUntrust={untrustPublisher} />
      {error ? <p className="plugin-card__error">{error}</p> : null}
    </>
  );
}
