import { useEffect, useMemo } from "react";
import { openDevicePrivacySettings } from "../device-use/api";
import type { TodosIsland } from "../todos/plugin/islandState";
import { useTranslation } from "../../i18n";
import { getErrorMessage } from "../../utils/error";
import { configureVoiceInput } from "./api";
import { appendToNote } from "./settings";
import { useVoiceInput } from "./useVoiceInput";
import { useVoiceInputSettings } from "./useVoiceInputSettings";
import { VoiceInputNotice, VoiceInputNoticeActions, type VoiceDraftActions } from "./VoiceInputNotice";

type Host = {
  openSettings: (section: "voiceInput") => void;
  takeClickFocus: () => Promise<void>;
};

function logError(error: unknown) {
  console.error("Voice input failed", getErrorMessage(error));
}

export function useIslandVoiceInput(todos: TodosIsland | null, { openSettings, takeClickFocus }: Host) {
  const t = useTranslation().voiceInput;
  const [settings] = useVoiceInputSettings();
  const voice = useVoiceInput();

  useEffect(() => {
    configureVoiceInput(settings.enabled, settings.shortcut).catch(logError);
  }, [settings.enabled, settings.shortcut]);

  const { draft, notify } = voice;
  const addTodoOn = todos?.addTodoOn;
  const currentDate = todos?.notebookProps.currentDate ?? "";
  const dailyNote = todos?.notebookProps.dailyNote ?? "";
  const onDailyNoteChange = todos?.notebookProps.onDailyNoteChange;
  const actions = useMemo<VoiceDraftActions>(() => ({
    saveTodo: () => {
      const title = draft.trim();
      if (!title || !addTodoOn) return;
      addTodoOn(title, currentDate);
      notify(t.savedTodo);
    },
    saveNote: () => {
      if (!draft.trim() || !onDailyNoteChange) return;
      onDailyNoteChange(appendToNote(dailyNote, draft));
      notify(t.savedNote);
    },
    copy: () => {
      navigator.clipboard.writeText(draft).then(() => notify(t.copied)).catch(logError);
    },
    openSettings: () => openSettings("voiceInput"),
    openPrivacy: () => { void openDevicePrivacySettings("microphone").catch(logError); },
    requestFocus: () => { void takeClickFocus().catch(logError); },
  }), [addTodoOn, currentDate, dailyNote, draft, notify, onDailyNoteChange, openSettings, t, takeClickFocus]);

  if (!voice.view) return null;
  return {
    content: <VoiceInputNotice voice={voice} actions={actions} />,
    actions: <VoiceInputNoticeActions voice={voice} actions={actions} />,
  };
}
