import { PageShortcutSection } from "./sections/PageShortcutSection";
import type { IslandSettings } from "../../lib/settings/types";
import { PluginShortcutSection } from "../../features/plugins/PluginShortcutSection";
import { PluginV3ShortcutSection } from "./PluginV3ShortcutSection";
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

function ClipboardReference() {
  const text = useTranslation().settings.shortcuts;
  return (
    <ShortcutReferenceGroup
      title={text.clipboardWindowTitle}
      rows={[
        [text.clipboardPreview, "Space"],
        [text.clipboardSnippetsTab, "Tab"],
        [text.clipboardPlainPaste, "Shift+Enter"],
        [text.clipboardAiRewrite, isMacOS ? "Cmd+I" : "Ctrl+I"],
        [text.clipboardQuickPick, "Alt+1–9"],
      ]}
    />
  );
}

function PluginsV3Section({ onOpenPage, takenBy, refreshPlugins }: ShortcutsSectionProps) {
  return <PluginV3ShortcutSection takenBy={takenBy} onChanged={refreshPlugins} action={<FeaturePageLink page="pluginsV3" onOpenPage={onOpenPage} />} />;
}

function PluginsSection({ onOpenPage, takenBy, refreshPlugins }: ShortcutsSectionProps) {
  return <PluginShortcutSection takenBy={takenBy} onChanged={refreshPlugins} action={<FeaturePageLink page="plugins" onOpenPage={onOpenPage} />} />;
}

shortcutSections.add({ id: "shortcuts.pluginsV3", category: "shortcuts", order: 48, component: PluginsV3Section });
shortcutSections.add({ id: "shortcuts.plugins", category: "shortcuts", order: 50, component: PluginsSection });
shortcutSections.add({ id: "shortcutsIsland.pages", category: "shortcutsIsland", order: 10, component: PageKeysSection });
shortcutReferences.add({ id: "shortcutsReference.island", category: "shortcutsReference", order: 10, component: IslandReference });
shortcutReferences.add({ id: "shortcutsReference.clipboard", category: "shortcutsReference", order: 15, component: ClipboardReference });

export function ShortcutsSettingsPage({
  tab,
  settings,
  onSettingsChange,
  onOpenPage,
}: {
  tab: "shortcuts" | "shortcutsIsland" | "shortcutsReference";
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
  onOpenPage: (page: SettingsCategory) => void;
}) {
  const { owners, finderOnly, takenBy, refreshPlugins } = useShortcutOwners(settings);
  const props = { settings, onSettingsChange, onOpenPage, takenBy, refreshPlugins };

  return (
    <>
      {tab !== "shortcutsReference" && <ShortcutFinder owners={[...owners, ...finderOnly]} onOpenPage={onOpenPage} />}
      {tab === "shortcutsReference" ? (
        <div className="shortcut-sheet">
          <SlotView slot={shortcutReferences} group="shortcutsReference" props={props} />
        </div>
      ) : (
        <SlotView slot={shortcutSections} group={tab} props={props} />
      )}
    </>
  );
}
