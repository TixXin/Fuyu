import { useTranslation } from "../../../i18n";
import { settingsRunners } from "../../plugin-kernel/settingsSlots";
import { useReportShortcutOwners } from "../../../lib/shortcut/useReportShortcutOwners";
import { normalizeClipboardShortcut } from "../shortcut";
import { useClipboardSettings } from "../useClipboardSettings";
import type { ComponentProps, ComponentType } from "react";
import { addSettingsCategory } from "../../plugin-kernel/settingsCategories";
import { FeaturePageLink } from "../../../components/settings/FeaturePageLink";
import { shortcutSections, type ShortcutsSectionProps } from "../../plugin-kernel/settingsSlots";
import { ClipboardSettingsPage } from "../ClipboardSettingsPage";
import { ClipboardShortcutGroup } from "../ClipboardShortcutGroup";
import type { IslandSettings } from "../../../lib/settings/types";

type PageProps = {
  settings: IslandSettings;
  onOpenShortcuts(): void;
};

function ClipboardShortcutOwners() {
  const t = useTranslation();
  const [clipboard] = useClipboardSettings();
  useReportShortcutOwners("clipboard", 20, clipboard.enabled && clipboard.shortcutEnabled
    ? [{ id: "clipboard", label: t.settings.clipboard.shortcut, shortcut: normalizeClipboardShortcut(clipboard.shortcut), home: "clipboard" }]
    : []);
  return null;
}

settingsRunners.add({ id: "clipboard.shortcut-owners", component: ClipboardShortcutOwners });

function ClipboardShortcutsSection({ onOpenPage, takenBy }: ShortcutsSectionProps) {
  const t = useTranslation();
  const [clipboard, updateClipboard] = useClipboardSettings();
  return (
    <ClipboardShortcutGroup
      title={t.settings.categories.clipboard}
      action={<FeaturePageLink page="clipboard" onOpenPage={onOpenPage} />}
      clipboard={clipboard}
      onClipboardChange={updateClipboard}
      takenBy={takenBy}
      onTurnOn={() => updateClipboard({ ...clipboard, enabled: true })}
    />
  );
}

shortcutSections.add({ id: "shortcuts.clipboard", category: "shortcuts", order: 20, component: ClipboardShortcutsSection });

const clipboardPage = (tab: ComponentProps<typeof ClipboardSettingsPage>["tab"]): ComponentType<PageProps> =>
  function ClipboardPage({ settings, onOpenShortcuts }) {
    return <ClipboardSettingsPage tab={tab} settings={settings} onOpenShortcuts={onOpenShortcuts} />;
  };

addSettingsCategory("clipboard", clipboardPage("clipboard"));
addSettingsCategory("clipboardHistory", clipboardPage("clipboardHistory"));
addSettingsCategory("clipboardSnippets", clipboardPage("clipboardSnippets"));
addSettingsCategory("clipboardData", clipboardPage("clipboardData"));
