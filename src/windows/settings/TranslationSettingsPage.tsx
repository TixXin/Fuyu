import type { IslandSettings, TranslationTarget } from "../../features/appearance/types";
import { useClipboardSettings } from "../../features/clipboard/useClipboardSettings";
import { TranslationSettingsSection } from "../../features/translation/TranslationSettingsSection";
import { useTranslationSettings } from "../../features/translation/useTranslationSettings";
import { useTranslation } from "../../i18n";
import { FeatureHeader } from "./FeatureHeader";
import { TranslationShortcutGroup } from "./ShortcutGroups";
import { AllShortcutsLink } from "./ShortcutsSettingsPage";
import { useShortcutOwners } from "./useShortcutOwners";
import { AppWindow } from "lucide-react";
import { SettingsChoiceCards } from "../../components/settings/SettingsChoiceCards";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { IslandGlyph } from "../../features/appearance/IslandGlyph";
import { SettingsRow } from "../../components/settings/SettingsRow";

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
  const [translationSettings, setTranslationSettings] = useTranslationSettings();
  const [clipboardSettings] = useClipboardSettings();
  const { takenBy } = useShortcutOwners({ settings, clipboard: clipboardSettings, translation: translationSettings });
  return (
    <>
      <FeatureHeader
        feature="translation"
        checked={settings.translationEnabled}
        onChange={(translationEnabled) => onSettingsChange({ ...settings, translationEnabled })}
      />
      {settings.translationEnabled && (
        <TranslationSettingsSection
          settings={translationSettings}
          setSettings={setTranslationSettings}
          useFooter={<SettingsFootnote text={t.settings.translation.targetHint} />}
          lead={
            <SettingsRow title={t.settings.translation.target}>
              <SettingsChoiceCards<TranslationTarget>
                value={settings.translationTarget}
                ariaLabel={t.settings.translation.target}
                options={[
                  { value: "window", label: t.settings.translation.targetWindow, art: <AppWindow size={30} strokeWidth={1.4} /> },
                  { value: "island", label: t.settings.translation.targetIsland, art: <IslandGlyph state="expanded" /> },
                ]}
                onChange={(translationTarget) => onSettingsChange({ ...settings, translationTarget })}
              />
            </SettingsRow>
          }
        />
      )}
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
