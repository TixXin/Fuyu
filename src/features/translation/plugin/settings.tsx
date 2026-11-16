import { useTranslation } from "../../../i18n";
import { runnerSlot, type SettingsRunnerProps } from "../../../windows/settings/slots/runnerSlot";
import { useReportShortcutOwners } from "../../../windows/settings/useReportShortcutOwners";
import { useTranslationSettings } from "../useTranslationSettings";

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
