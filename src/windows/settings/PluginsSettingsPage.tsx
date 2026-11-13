import type { IslandSettings } from "../../features/appearance/types";
import { useClipboardSettings } from "../../features/clipboard/useClipboardSettings";
import { PluginDevSection } from "../../features/plugin-dev/PluginDevSection";
import { PluginIslandPagesSection } from "../../features/plugin-views/PluginIslandPagesSection";
import { PluginShortcutSection } from "../../features/plugins/PluginShortcutSection";
import { PluginUpdatesTab } from "../../features/plugins/PluginUpdatesTab";
import { PluginsSettingsSection } from "../../features/plugins/PluginsSettingsSection";
import { useTranslationSettings } from "../../features/translation/useTranslationSettings";
import { AllShortcutsLink } from "./ShortcutsSettingsPage";
import { useShortcutOwners } from "./useShortcutOwners";
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
  const [clipboardSettings] = useClipboardSettings();
  const [translationSettings] = useTranslationSettings();
  const { takenBy, refreshPlugins } = useShortcutOwners({ settings, clipboard: clipboardSettings, translation: translationSettings });
  if (tab === "pluginsDev") return <PluginDevSection />;
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
