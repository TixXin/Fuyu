import { useTranslation } from "../../../i18n";
import { settingsRunners, type SettingsRunnerProps } from "../../plugin-kernel/settingsSlots";
import { useReportShortcutOwners } from "../../../lib/shortcut/useReportShortcutOwners";
import { useTranslationSettings } from "../useTranslationSettings";
import { addSettingsCategory } from "../../plugin-kernel/settingsCategories";
import { FeaturePageLink } from "../../../components/settings/FeaturePageLink";
import { ShortcutReferenceGroup } from "../../../components/settings/ShortcutReferenceGroup";
import { shortcutReferences, shortcutSections, type ShortcutsSectionProps } from "../../plugin-kernel/settingsSlots";
import { TranslationSettingsPage } from "../TranslationSettingsPage";
import { TranslationShortcutGroup } from "../TranslationShortcutGroup";
import type { IslandSettings } from "../../../lib/settings/types";
import { OWNER } from "./owner.ts";

type PageProps = {
  settings: IslandSettings;
  onSettingsChange(settings: IslandSettings): void;
  onOpenShortcuts(): void;
};

function TranslationShortcutOwners({ settings }: SettingsRunnerProps) {
  const t = useTranslation();
  const [translation] = useTranslationSettings();
  useReportShortcutOwners("translation", 10, settings.translationEnabled ? [
    { id: "window", label: t.settings.shortcuts.openTranslation, shortcut: translation.shortcut, home: "translation" },
    { id: "selection", label: t.settings.translation.selectionShortcut, shortcut: translation.selectionShortcut, home: "translation" },
  ] : []);
  return null;
}

settingsRunners.add({ id: "translation.shortcut-owners", component: TranslationShortcutOwners }, OWNER);

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

shortcutSections.add({ id: "shortcuts.translation", category: "shortcuts", order: 10, component: TranslationShortcutsSection }, OWNER);
shortcutReferences.add({ id: "shortcutsReference.input", category: "shortcutsReference", order: 20, component: TranslationInputReference }, OWNER);

addSettingsCategory("translation", ({ settings, onSettingsChange, onOpenShortcuts }: PageProps) => <TranslationSettingsPage settings={settings} onSettingsChange={onSettingsChange} onOpenShortcuts={onOpenShortcuts} />, OWNER);
