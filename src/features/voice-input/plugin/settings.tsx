import { useTranslation } from "../../../i18n";
import { runnerSlot } from "../../../windows/settings/slots/runnerSlot";
import { useReportShortcutOwners } from "../../../windows/settings/useReportShortcutOwners";
import { useVoiceInputSettings } from "../useVoiceInputSettings";
import { addSettingsCategory } from "../../../windows/settings/slots/categorySlot";
import { VoiceInputSettingsPage } from "../VoiceInputSettingsPage";

function VoiceInputShortcutOwners() {
  const t = useTranslation();
  const [voice] = useVoiceInputSettings();
  useReportShortcutOwners("voiceInput", 40, voice.enabled && voice.shortcut
    ? [{ id: "voiceInput", label: t.voiceInput.settings.shortcut, shortcut: voice.shortcut, home: "voiceInput" }]
    : []);
  return null;
}

runnerSlot.add({ id: "voice-input.shortcut-owners", component: VoiceInputShortcutOwners });

addSettingsCategory("voiceInput", ({ settings }) => <VoiceInputSettingsPage settings={settings} />);
