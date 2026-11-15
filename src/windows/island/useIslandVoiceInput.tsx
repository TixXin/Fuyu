import { useEffect, useMemo } from "react";
import { openDevicePrivacySettings } from "../../features/device-use/api";
import { configureVoiceInput } from "../../features/voice-input/api";
import { appendToNote } from "../../features/voice-input/settings";
import { useVoiceInput } from "../../features/voice-input/useVoiceInput";
import { useVoiceInputSettings } from "../../features/voice-input/useVoiceInputSettings";
import { VoiceInputNotice, VoiceInputNoticeActions, type VoiceDraftActions } from "../../features/voice-input/VoiceInputNotice";
import { useTranslation } from "../../i18n";
import { getErrorMessage } from "../../utils/error";
import { openSettingsWindow } from "../settings/api";
import { takeIslandClickFocus } from "./api";

type Notebook = {
  currentDate: string;
  dailyNote: string;
  onDailyNoteChange: (note: string) => void;
};

function logError(error: unknown) {
  console.error("Voice input failed", getErrorMessage(error));
}

export function useIslandVoiceInput(addTodoOn: (title: string, date: string) => void, notebook: Notebook) {
  const t = useTranslation().voiceInput;
  const [settings] = useVoiceInputSettings();
  const voice = useVoiceInput();

  useEffect(() => {
    configureVoiceInput(settings.enabled, settings.shortcut).catch(logError);
  }, [settings.enabled, settings.shortcut]);

  const { draft, notify } = voice;
  const { currentDate, dailyNote, onDailyNoteChange } = notebook;
  const actions = useMemo<VoiceDraftActions>(() => ({
    saveTodo: () => {
      const title = draft.trim();
      if (!title) return;
      addTodoOn(title, currentDate);
      notify(t.savedTodo);
    },
    saveNote: () => {
      if (!draft.trim()) return;
      onDailyNoteChange(appendToNote(dailyNote, draft));
      notify(t.savedNote);
    },
    copy: () => {
      navigator.clipboard.writeText(draft).then(() => notify(t.copied)).catch(logError);
    },
    openSettings: () => openSettingsWindow("voiceInput"),
    openPrivacy: () => { void openDevicePrivacySettings("microphone").catch(logError); },
    requestFocus: () => { void takeIslandClickFocus().catch(logError); },
  }), [addTodoOn, currentDate, dailyNote, draft, notify, onDailyNoteChange, t]);

  if (!voice.view) return null;
  return {
    content: <VoiceInputNotice voice={voice} actions={actions} />,
    actions: <VoiceInputNoticeActions voice={voice} actions={actions} />,
  };
}
