import type { IslandSettings } from "../../features/appearance/types";
import { useClipboardSettings } from "../../features/clipboard/useClipboardSettings";
import { PluginDevSection } from "../../features/plugin-dev/PluginDevSection";
import { PluginIslandPagesSection } from "../../features/plugin-views/PluginIslandPagesSection";
import { PluginShortcutSection } from "../../features/plugins/PluginShortcutSection";
import { PluginsSettingsSection } from "../../features/plugins/PluginsSettingsSection";
import { useTranslationSettings } from "../../features/translation/useTranslationSettings";
import { AllShortcutsLink } from "./ShortcutsSettingsPage";
import { useShortcutOwners } from "./useShortcutOwners";
import "./ShortcutsSettingsPage.css";

/**
 * Plugins: what is installed, the plugins' island pages, their shortcuts (also on the Shortcuts
 * page; left out while no plugin has a command) and, last and folded, the developer tools. The
 * market has its own page; Manage there opens that plugin here.
 */
export function PluginsSettingsPage({
  settings,
  managedPluginId,
  onOpenShortcuts,
}: {
  settings: IslandSettings;
  /** The plugin Manage was pressed for in the market, opened at once. */
  managedPluginId: string | null;
  onOpenShortcuts: () => void;
}) {
  const [clipboardSettings] = useClipboardSettings();
  const [translationSettings] = useTranslationSettings();
  const { takenBy, refreshPlugins } = useShortcutOwners({ settings, clipboard: clipboardSettings, translation: translationSettings });
  return (
    <>
      <PluginsSettingsSection key={managedPluginId ?? "list"} initialOpenId={managedPluginId} />
      <PluginIslandPagesSection />
      <PluginShortcutSection takenBy={takenBy} onChanged={refreshPlugins} action={<AllShortcutsLink onOpen={onOpenShortcuts} />} hideWhenEmpty />
      <PluginDevSection />
    </>
  );
}
