import { useMemo, useState } from "react";
import { FolderOpen, RefreshCcw } from "lucide-react";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";
import type { PluginInfo } from "./api";
import { InstalledPluginsToolbar } from "./InstalledPluginsToolbar";
import { filterInstalledPlugins, installedCounts, type InstalledFilter } from "./installedFilter";
import { PluginCard } from "./PluginCard";
import { PluginDock } from "./PluginDock";
import { PluginDetailPage } from "./PluginDetailPage";
import { PluginNotice } from "./PluginNotice";
import { RuntimeBanner } from "./RuntimeBanner";
import { usePlugins } from "./usePlugins";
import "./PluginsSettingsSection.css";

export function PluginsSettingsSection({ initialOpenId = null }: { initialOpenId?: string | null } = {}) {
  const t = useTranslation();
  const {
    snapshot,
    error,
    busy,
    notice,
    setAllowed,
    setEnabled,
    setSetting,
    setNotificationsMuted,
    setPreRelease,
    setMemoryLimit,
    revokeSensitive,
    clearData,
    reload,
    openFolder,
    runCommand,
    uninstall,
  } = usePlugins();
  const [openId, setOpenId] = useState<string | null>(initialOpenId);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<InstalledFilter>("all");
  const allowed = snapshot?.allowThirdParty ?? false;
  const plugins = useMemo(() => snapshot?.plugins ?? [], [snapshot]);
  const counts = useMemo(() => installedCounts(plugins, allowed), [plugins, allowed]);
  const shown = useMemo(() => filterInstalledPlugins(plugins, filter, query, allowed), [plugins, filter, query, allowed]);
  const openPlugin = snapshot?.plugins.find((plugin) => plugin.id === openId);

  const renderGroup = (title: string, group: PluginInfo[]) =>
    snapshot && group.length > 0 ? (
      <section className="plugins-list" aria-label={title}>
        <h3 className="plugins-list__title">{title}</h3>
        <div className="plugins-list__grid">
          {group.map((plugin, index) => (
            <PluginCard
              key={plugin.id}
              index={index}
              plugin={plugin}
              allowed={allowed}
              nodeAvailable={snapshot.nodeAvailable}
              powershellAvailable={snapshot.powershellAvailable}
              busy={busy}
              onEnabledChange={(enabled) => setEnabled(plugin.id, enabled)}
              onOpenDetail={() => setOpenId(plugin.id)}
              onUninstall={() => uninstall(plugin.id)}
            />
          ))}
        </div>
      </section>
    ) : null;
  const thirdParty = shown.filter((plugin) => !plugin.builtin);
  const builtin = shown.filter((plugin) => plugin.builtin);

  return (
    <>
      {plugins.length > 0 ? <PluginDock plugins={plugins} allowed={allowed} filter={filter} counts={counts} onFilterChange={setFilter} onOpen={setOpenId} /> : null}
      <SettingsGroup footer={<SettingsFootnote text={t.settings.plugins.warning} />}>
        <SettingsToggleRow title={t.settings.plugins.allowThirdParty} checked={allowed} onChange={(next) => !busy && setAllowed(next)} />
        <SettingsRow
          title={t.settings.plugins.folder}
          description={
            <code className="plugins-folder__path" dir="rtl" data-search="off">
              <bdi>{snapshot?.pluginsDir ?? ""}</bdi>
            </code>
          }
          control={
            <>
              <button
                className="plugin-card__button plugins-folder__icon"
                type="button"
                aria-label={t.settings.plugins.openFolder}
                onClick={openFolder}
              >
                <FolderOpen size={13} strokeWidth={2.4} />
              </button>
              <button
                className="plugin-card__button plugins-folder__icon"
                type="button"
                aria-label={t.settings.plugins.reload}
                disabled={busy}
                onClick={reload}
              >
                <RefreshCcw size={13} strokeWidth={2.4} />
              </button>
            </>
          }
        />
      </SettingsGroup>
      {snapshot?.brokenStateBackup ? <p className="plugin-card__error" role="alert">{t.settings.plugins.brokenState(snapshot.brokenStateBackup)}</p> : null}
      <PluginNotice notice={notice} action={["reload", "folder"]} />
      {error ? <p className="plugin-card__error">{error}</p> : null}
      {snapshot && plugins.length === 0 ? <p className="settings-section__hint">{t.settings.plugins.empty}</p> : null}
      {snapshot ? <RuntimeBanner plugins={plugins} nodeAvailable={snapshot.nodeAvailable} powershellAvailable={snapshot.powershellAvailable} /> : null}
      {plugins.length > 0 ? (
        <InstalledPluginsToolbar query={query} onQueryChange={setQuery} />
      ) : null}
      {plugins.length > 0 && shown.length === 0 ? <p className="settings-section__hint plugins-list__empty">{t.settings.plugins.overview.noMatches}</p> : null}
      {renderGroup(t.settings.plugins.groupThirdParty(thirdParty.length), thirdParty)}
      {renderGroup(t.settings.plugins.groupBuiltin(builtin.length), builtin)}
      {openPlugin && snapshot ? (
        <PluginDetailPage
          plugin={openPlugin}
          busy={busy}
          notice={notice}
          allowed={allowed}
          nodeAvailable={snapshot.nodeAvailable}
          powershellAvailable={snapshot.powershellAvailable}
          onBack={() => setOpenId(null)}
          onEnabledChange={(enabled) => setEnabled(openPlugin.id, enabled)}
          onSettingChange={(key, value) => setSetting(openPlugin.id, key, value)}
          onRunCommand={(command) => runCommand(openPlugin.id, command)}
          onNotificationsMutedChange={(muted) => setNotificationsMuted(openPlugin.id, muted)}
          onPreReleaseChange={(enabled) => setPreRelease(openPlugin.id, enabled)}
          onMemoryLimitChange={(megabytes) => setMemoryLimit(openPlugin.id, megabytes)}
          onClearData={() => clearData(openPlugin.id)}
          onRevokeSensitive={(permission) => revokeSensitive(openPlugin.id, permission)}
        />
      ) : null}
    </>
  );
}
