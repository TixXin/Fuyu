import { todosV1 } from "@fuyu/plugin-services";
import { useEffect, useMemo } from "react";
import { useTranslation } from "../../i18n";
import { openDevicePrivacySettings } from "../../lib/system-permissions/api";
import { splitProjectPrefix } from "../../lib/todo-projects/prefix.ts";
import { getErrorMessage } from "../../utils/error";
import { windowServices } from "../plugin-kernel/services";
import { configureVoiceInput } from "./api";
import { appendToNote } from "./settings";
import { useVoiceInput } from "./useVoiceInput";
import { useVoiceInputSettings } from "./useVoiceInputSettings";
import { VoiceInputNotice, VoiceInputNoticeActions, type VoiceDraftActions } from "./VoiceInputNotice";

type Host = {
  openSettings: (section: "voiceInput") => void;
  takeClickFocus: () => Promise<void>;
};

const todos = windowServices.get(todosV1);

function isTodosOff(error: unknown) {
  return (error as { code?: unknown } | null)?.code === "not-ready";
}

function logError(error: unknown) {
  console.error("Voice input failed", getErrorMessage(error));
}

export function useIslandVoiceInput({ openSettings, takeClickFocus }: Host) {
  const t = useTranslation().voiceInput;
  const [settings] = useVoiceInputSettings();
  const voice = useVoiceInput();

  useEffect(() => {
    configureVoiceInput(true, settings.shortcut).catch(logError);
  }, [settings.shortcut]);

  const { draft, notify } = voice;
  const actions = useMemo<VoiceDraftActions>(() => ({
    saveTodo: () => {
      const { title, project } = splitProjectPrefix(draft);
      if (!title) return;
      todos.add({ title, ...(project ? { project } : {}) })
        .then(() => notify(t.savedTodo))
        .catch((error: unknown) => {
          if (isTodosOff(error)) notify(t.todosOff);
          else logError(error);
        });
    },
    saveNote: () => {
      if (!draft.trim()) return;
      todos.note({})
        .then(({ note }) => todos.setNote({ note: appendToNote(note, draft) }))
        .then(() => notify(t.savedNote))
        .catch((error: unknown) => {
          if (isTodosOff(error)) notify(t.todosOff);
          else logError(error);
        });
    },
    copy: () => {
      navigator.clipboard.writeText(draft).then(() => notify(t.copied)).catch(logError);
    },
    openSettings: () => openSettings("voiceInput"),
    openPrivacy: () => { void openDevicePrivacySettings("microphone").catch(logError); },
    requestFocus: () => { void takeClickFocus().catch(logError); },
  }), [draft, notify, openSettings, t, takeClickFocus]);

  if (!voice.view) return null;
  return {
    content: <VoiceInputNotice voice={voice} actions={actions} />,
    actions: <VoiceInputNoticeActions voice={voice} actions={actions} />,
  };
}
