import { PageShortcutSection } from "./sections/PageShortcutSection";
import type { IslandSettings } from "../../lib/settings/types";
import { PluginShortcutSection } from "../../features/plugins/PluginShortcutSection";
import { useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import type { SettingsCategory } from "./categories";
import { FeaturePageLink } from "../../components/settings/FeaturePageLink";
import { ShortcutFinder } from "./ShortcutFinder";
import { ShortcutReferenceGroup } from "../../components/settings/ShortcutReferenceGroup";
import { useShortcutOwners } from "../../lib/shortcut/useShortcutOwners";
import "./ShortcutsSettingsPage.css";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { shortcutReferences, shortcutSections, type ShortcutsSectionProps } from "../../features/plugin-kernel/settingsSlots";

function PageKeysSection({ settings, onSettingsChange, takenBy }: ShortcutsSectionProps) {
  return <PageShortcutSection settings={settings} onSettingsChange={onSettingsChange} takenBy={takenBy} />;
}

function IslandReference() {
  const t = useTranslation();
  const text = t.settings.shortcuts;
  return (
    <ShortcutReferenceGroup
      title={text.islandTitle}
      rows={[[text.collapse, "Esc"], [text.moveIsland, isMacOS ? text.altDragMac : text.altDrag], isMacOS ? [text.holdPanelMac, text.holdControlMac] : [text.resizePanel, text.altDragEdge]]}
    />
  );
}

function ReferenceSheetSection(props: ShortcutsSectionProps) {
  return (
    <div className="shortcut-sheet">
      <SlotView slot={shortcutReferences} group="shortcutsReference" props={props} />
    </div>
  );
}

function PluginsSection({ onOpenPage, takenBy, refreshPlugins }: ShortcutsSectionProps) {
  return <PluginShortcutSection takenBy={takenBy} onChanged={refreshPlugins} action={<FeaturePageLink page="plugins" onOpenPage={onOpenPage} />} />;
}

shortcutSections.add({ id: "shortcuts.plugins", category: "shortcuts", order: 50, component: PluginsSection });
shortcutSections.add({ id: "shortcutsIsland.pages", category: "shortcutsIsland", order: 10, component: PageKeysSection });
shortcutSections.add({ id: "shortcutsIsland.reference", category: "shortcutsIsland", order: 20, component: ReferenceSheetSection });
shortcutReferences.add({ id: "shortcutsReference.island", category: "shortcutsReference", order: 10, component: IslandReference });

export function ShortcutsSettingsPage({
  tab,
  settings,
  onSettingsChange,
  onOpenPage,
}: {
  tab: "shortcuts" | "shortcutsIsland";
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
  onOpenPage: (page: SettingsCategory) => void;
}) {
  const { owners, finderOnly, takenBy, refreshPlugins } = useShortcutOwners(settings);
  const props = { settings, onSettingsChange, onOpenPage, takenBy, refreshPlugins };

  return (
    <>
      <ShortcutFinder owners={[...owners, ...finderOnly]} onOpenPage={onOpenPage} />
      <SlotView slot={shortcutSections} group={tab} props={props} />
    </>
  );
}
