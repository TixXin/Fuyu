import type { IslandSettings, TranslationTarget } from "../../features/appearance/types";
import { useClipboardSettings } from "../../features/clipboard/useClipboardSettings";
import { TranslationSettingsSection } from "../../features/translation/TranslationSettingsSection";
import { useTranslationSettings } from "../../features/translation/useTranslationSettings";
import { useTranslation } from "../../i18n";
import { ModuleSwitchSection } from "./ModuleSwitchSection";
import { TranslationShortcutGroup } from "./ShortcutGroups";
import { AllShortcutsLink } from "./ShortcutsSettingsPage";
import { useShortcutOwners } from "./useShortcutOwners";
import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";

/** Settings → Translation. Its shortcuts are recorded here as well as on the Shortcuts page. */
export function TranslationSettingsPage({
  settings,
  onSettingsChange,
  onOpenShortcuts,
}: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
  onOpenShortcuts: () => void;
}) {
  const t = useTranslation();
  // The one copy on this page: the service section and the shortcut group both edit it.
  const [translationSettings, setTranslationSettings] = useTranslationSettings();
  const [clipboardSettings] = useClipboardSettings();
  const { takenBy } = useShortcutOwners({ settings, clipboard: clipboardSettings, translation: translationSettings });
  const targets = [
    { value: "window", label: t.settings.translation.targetWindow },
    { value: "island", label: t.settings.translation.targetIsland },
  ] as const;

  return (
    <>
      <ModuleSwitchSection
        label={t.settings.modules.translation}
        checked={settings.translationEnabled}
        onChange={(translationEnabled) => onSettingsChange({ ...settings, translationEnabled })}
      />
      {settings.translationEnabled && (
        <SettingsGroup title={t.settings.translation.targetTitle} footer={t.settings.translation.targetHint}>
          <SettingsRow
            title={t.settings.translation.target}
            control={
              <SettingsChoice<TranslationTarget>
                value={settings.translationTarget}
                options={targets}
                ariaLabel={t.settings.translation.target}
                onChange={(translationTarget) => onSettingsChange({ ...settings, translationTarget })}
              />
            }
          />
        </SettingsGroup>
      )}
      {settings.translationEnabled && <TranslationSettingsSection settings={translationSettings} setSettings={setTranslationSettings} />}
      <TranslationShortcutGroup
        title={t.settings.shortcuts.featureTitle}
        action={<AllShortcutsLink onOpen={onOpenShortcuts} />}
        enabled={settings.translationEnabled}
        translation={translationSettings}
        onTranslationChange={setTranslationSettings}
        takenBy={takenBy}
      />
    </>
  );
}
