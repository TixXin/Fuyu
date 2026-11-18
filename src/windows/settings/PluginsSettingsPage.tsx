import type { IslandSettings } from "../../lib/settings/types";
import { PluginDevSection } from "../../features/plugin-dev/PluginDevSection";
import { PluginIslandPagesSection } from "../../features/plugin-views/PluginIslandPagesSection";
import { PluginShortcutSection } from "../../features/plugins/PluginShortcutSection";
import { PluginUpdatesTab } from "../../features/plugins/PluginUpdatesTab";
import { PluginsSettingsSection } from "../../features/plugins/PluginsSettingsSection";
import { AllShortcutsLink } from "../../components/settings/AllShortcutsLink";
import { useShortcutOwners } from "../../lib/shortcut/useShortcutOwners";
import "./ShortcutsSettingsPage.css";

export function PluginsSettingsPage({
  tab,
  settings,
  managedPluginId,
  onOpenShortcuts,
}: {
  tab: "plugins" | "pluginsPages" | "pluginsUpdates" | "pluginsDev";
  settings: IslandSettings;
  managedPluginId: string | null;
  onOpenShortcuts: () => void;
}) {
  const { takenBy, refreshPlugins } = useShortcutOwners(settings);
  if (tab === "pluginsDev") return <PluginDevSection defaultOpen />;
  if (tab === "pluginsUpdates") return <PluginUpdatesTab />;
  if (tab === "pluginsPages") {
    return (
      <>
        <PluginIslandPagesSection />
        <PluginShortcutSection takenBy={takenBy} onChanged={refreshPlugins} action={<AllShortcutsLink onOpen={onOpenShortcuts} />} hideWhenEmpty />
      </>
    );
  }
  return <PluginsSettingsSection key={managedPluginId ?? "list"} initialOpenId={managedPluginId} />;
}
