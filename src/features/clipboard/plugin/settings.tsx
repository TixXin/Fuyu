import { useTranslation } from "../../../i18n";
import { runnerSlot } from "../../../windows/settings/slots/runnerSlot";
import { useReportShortcutOwners } from "../../../windows/settings/useReportShortcutOwners";
import { normalizeClipboardShortcut } from "../shortcut";
import { useClipboardSettings } from "../useClipboardSettings";
import type { ComponentProps, ComponentType } from "react";
import { addSettingsCategory, type SettingsPageProps } from "../../../windows/settings/slots/categorySlot";
import { FeaturePageLink } from "../../../windows/settings/FeaturePageLink";
import { shortcutSections, type ShortcutsSectionProps } from "../../../windows/settings/slots/shortcutSlots";
import { ClipboardSettingsPage } from "../ClipboardSettingsPage";
import { ClipboardShortcutGroup } from "../ClipboardShortcutGroup";

function ClipboardShortcutOwners() {
  const t = useTranslation();
  const [clipboard] = useClipboardSettings();
  useReportShortcutOwners("clipboard", 20, clipboard.enabled && clipboard.shortcutEnabled
    ? [{ id: "clipboard", label: t.settings.clipboard.shortcut, shortcut: normalizeClipboardShortcut(clipboard.shortcut), home: "clipboard" }]
    : []);
  return null;
}

runnerSlot.add({ id: "clipboard.shortcut-owners", component: ClipboardShortcutOwners });

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

const clipboardPage = (tab: ComponentProps<typeof ClipboardSettingsPage>["tab"]): ComponentType<SettingsPageProps> =>
  function ClipboardPage({ settings, onOpenShortcuts }) {
    return <ClipboardSettingsPage tab={tab} settings={settings} onOpenShortcuts={onOpenShortcuts} />;
  };

addSettingsCategory("clipboard", clipboardPage("clipboard"));
addSettingsCategory("clipboardHistory", clipboardPage("clipboardHistory"));
addSettingsCategory("clipboardSnippets", clipboardPage("clipboardSnippets"));
addSettingsCategory("clipboardData", clipboardPage("clipboardData"));
