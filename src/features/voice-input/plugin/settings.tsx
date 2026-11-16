import { useTranslation } from "../../../i18n";
import { settingsRunners } from "../../plugin-kernel/settingsSlots";
import { useReportShortcutOwners } from "../../../lib/shortcut/useReportShortcutOwners";
import { useVoiceInputSettings } from "../useVoiceInputSettings";
import { addSettingsCategory } from "../../plugin-kernel/settingsCategories";
import { VoiceInputSettingsPage } from "../VoiceInputSettingsPage";
import type { IslandSettings } from "../../../lib/settings/types";

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

settingsRunners.add({ id: "voice-input.shortcut-owners", component: VoiceInputShortcutOwners });

addSettingsCategory("voiceInput", ({ settings }: PageProps) => <VoiceInputSettingsPage settings={settings} />);
