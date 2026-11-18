import { FeaturePageLink } from "../../../components/settings/FeaturePageLink";
import { useTranslation } from "../../../i18n";
import type { IslandSettings } from "../../../lib/settings/types";
import { useReportShortcutOwners } from "../../../lib/shortcut/useReportShortcutOwners";
import { addSettingsCategory } from "../../plugin-kernel/settingsCategories";
import { settingsRunners, shortcutSections, type ShortcutsSectionProps } from "../../plugin-kernel/settingsSlots";
import { useVoiceInputSettings } from "../useVoiceInputSettings";
import { VoiceInputSettingsPage } from "../VoiceInputSettingsPage";
import { VoiceInputShortcutGroup } from "../VoiceInputShortcutGroup";
import { OWNER } from "./owner.ts";

type PageProps = {
  settings: IslandSettings;
};

function VoiceInputShortcutOwners() {
  const t = useTranslation();
  const [voice] = useVoiceInputSettings();
  useReportShortcutOwners("voiceInput", 40, voice.enabled && voice.shortcut
    ? [{ id: "voiceInput", label: t.voiceInput.settings.shortcut, shortcut: voice.shortcut, home: "voiceInput" }]
    : []);
  return null;
}

function VoiceInputShortcutsSection({ onOpenPage, takenBy }: ShortcutsSectionProps) {
  const [voice, setVoice] = useVoiceInputSettings();
  return (
    <VoiceInputShortcutGroup
      action={<FeaturePageLink page="voiceInput" onOpenPage={onOpenPage} />}
      settings={voice}
      onSettingsChange={setVoice}
      takenBy={(shortcut) => takenBy(shortcut, "voiceInput")}
    />
  );
}

settingsRunners.add({ id: "voice-input.shortcut-owners", component: VoiceInputShortcutOwners }, OWNER);
shortcutSections.add({ id: "shortcuts.voice-input", category: "shortcuts", order: 35, component: VoiceInputShortcutsSection }, OWNER);
addSettingsCategory("voiceInput", ({ settings }: PageProps) => <VoiceInputSettingsPage settings={settings} />, OWNER);
