import { useTranslation } from "../../../i18n";
import { runnerSlot, type SettingsRunnerProps } from "../../../windows/settings/slots/runnerSlot";
import { useReportShortcutOwners } from "../../../windows/settings/useReportShortcutOwners";
import { useTranslationSettings } from "../useTranslationSettings";
import { addSettingsCategory } from "../../../windows/settings/slots/categorySlot";
import { FeaturePageLink } from "../../../windows/settings/FeaturePageLink";
import { ShortcutReferenceGroup } from "../../../windows/settings/ShortcutReferenceGroup";
import { shortcutReferences, shortcutSections, type ShortcutsSectionProps } from "../../../windows/settings/slots/shortcutSlots";
import { TranslationSettingsPage } from "../TranslationSettingsPage";
import { TranslationShortcutGroup } from "../TranslationShortcutGroup";

function TranslationShortcutOwners({ settings }: SettingsRunnerProps) {
  const t = useTranslation();
  const [translation] = useTranslationSettings();
  useReportShortcutOwners("translation", 10, settings.translationEnabled ? [
    { id: "window", label: t.settings.shortcuts.openTranslation, shortcut: translation.shortcut, home: "translation" },
    { id: "selection", label: t.settings.translation.selectionShortcut, shortcut: translation.selectionShortcut, home: "translation" },
  ] : []);
  return null;
}

runnerSlot.add({ id: "translation.shortcut-owners", component: TranslationShortcutOwners });

function TranslationShortcutsSection({ settings, onSettingsChange, onOpenPage, takenBy }: ShortcutsSectionProps) {
  const t = useTranslation();
  const [translation, setTranslation] = useTranslationSettings();
  return (
    <TranslationShortcutGroup
      title={t.settings.categories.translation}
      action={<FeaturePageLink page="translation" onOpenPage={onOpenPage} />}
      enabled={settings.translationEnabled}
      translation={translation}
      onTranslationChange={setTranslation}
      takenBy={takenBy}
      onTurnOn={() => onSettingsChange({ ...settings, translationEnabled: true })}
    />
  );
}

function TranslationInputReference({ settings }: ShortcutsSectionProps) {
  const text = useTranslation().settings.shortcuts;
  if (!settings.translationEnabled) return null;
  return <ShortcutReferenceGroup title={text.inputTitle} rows={[[text.translate, "Enter"], [text.newLine, "Shift + Enter"], [text.pasteClipboard, "Tab"]]} />;
}

shortcutSections.add({ id: "shortcuts.translation", category: "shortcuts", order: 10, component: TranslationShortcutsSection });
shortcutReferences.add({ id: "shortcutsReference.input", category: "shortcutsReference", order: 20, component: TranslationInputReference });

addSettingsCategory("translation", ({ settings, onSettingsChange, onOpenShortcuts }) => <TranslationSettingsPage settings={settings} onSettingsChange={onSettingsChange} onOpenShortcuts={onOpenShortcuts} />);
