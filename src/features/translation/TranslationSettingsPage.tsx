import type { Dispatch, SetStateAction } from "react";
import type { IslandSettings, TranslationTarget } from "../../lib/settings/types";
import type { TranslationSettings } from "./storage";
import { TranslationSettingsSection } from "./TranslationSettingsSection";
import { useTranslationSettings } from "./useTranslationSettings";
import { useTranslation } from "../../i18n";
import { FeatureHeader } from "../../windows/settings/FeatureHeader";
import { TranslationShortcutGroup } from "./TranslationShortcutGroup";
import { AllShortcutsLink } from "../../windows/settings/ShortcutsSettingsPage";
import { useShortcutOwners } from "../../windows/settings/useShortcutOwners";
import { AppWindow } from "lucide-react";
import { SettingsChoiceCards } from "../../components/settings/SettingsChoiceCards";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { IslandGlyph } from "../../windows/settings/sections/IslandGlyph";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SlotView } from "../plugin-kernel/SlotView";
import { settingsSections } from "../../windows/settings/slots/sectionSlot";

type TranslationSectionProps = {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
  onOpenShortcuts: () => void;
  translation: TranslationSettings;
  onTranslationChange: Dispatch<SetStateAction<TranslationSettings>>;
  takenBy: ReturnType<typeof useShortcutOwners>["takenBy"];
};

function ServiceSection({ settings, onSettingsChange, translation, onTranslationChange }: TranslationSectionProps) {
  const t = useTranslation();
  return (
    <TranslationSettingsSection
      settings={translation}
      setSettings={onTranslationChange}
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
  );
}

function ShortcutsSection({ settings, onOpenShortcuts, translation, onTranslationChange, takenBy }: TranslationSectionProps) {
  const t = useTranslation();
  return (
    <TranslationShortcutGroup
      title={t.settings.shortcuts.featureTitle}
      action={<AllShortcutsLink onOpen={onOpenShortcuts} />}
      enabled={settings.translationEnabled}
      translation={translation}
      onTranslationChange={onTranslationChange}
      takenBy={takenBy}
    />
  );
}

const sections = settingsSections<TranslationSectionProps, "translation">();

sections.add({ id: "translation.service", category: "translation", order: 10, component: ServiceSection });
sections.add({ id: "translation.shortcuts", category: "translation", order: 20, component: ShortcutsSection });

export function TranslationSettingsPage({
  settings,
  onSettingsChange,
  onOpenShortcuts,
}: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
  onOpenShortcuts: () => void;
}) {
  const [translationSettings, setTranslationSettings] = useTranslationSettings();
  const { takenBy } = useShortcutOwners(settings);
  const props = { settings, onSettingsChange, onOpenShortcuts, translation: translationSettings, onTranslationChange: setTranslationSettings, takenBy };
  return (
    <>
      <FeatureHeader feature="translation" />
      <SlotView slot={sections} group="translation" props={props} />
    </>
  );
}
