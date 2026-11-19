import { useId } from "react";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useTranslation } from "../../i18n";
import { MAX_NOTE_TEMPLATE_LENGTH } from "./todoPrefs.ts";
import { useTodoPrefs } from "./useTodoPrefs";
import "./TodoNoteTemplateRow.css";

export function TodoNoteTemplateRow() {
  const text = useTranslation().settings.todo;
  const [prefs, setPrefs] = useTodoPrefs();
  const inputId = useId();

  return (
    <SettingsRow title={text.noteTemplate} description={text.noteTemplateHint} labelFor={inputId}>
      <textarea
        id={inputId}
        className="todo-note-template"
        value={prefs.noteTemplate}
        rows={4}
        maxLength={MAX_NOTE_TEMPLATE_LENGTH}
        placeholder={text.noteTemplatePlaceholder}
        spellCheck={false}
        onChange={(event) => {
          const noteTemplate = event.currentTarget.value;
          setPrefs((current) => ({ ...current, noteTemplate }));
        }}
      />
    </SettingsRow>
  );
}
