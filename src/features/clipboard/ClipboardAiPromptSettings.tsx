import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsInput } from "../../components/settings/SettingsInput";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import type { ClipboardAiPrompt, ClipboardHistorySettings } from "./api";
import "./ClipboardSnippetSettings.css";

type Draft = { id: string | null; title: string; prompt: string };

const newId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function ClipboardAiPromptSettings({ clipboardSettings, onChange }: {
  clipboardSettings: ClipboardHistorySettings;
  onChange: (settings: ClipboardHistorySettings) => void;
}) {
  const t = useTranslation();
  const text = t.settings.clipboard.aiPrompts;
  const prompts = clipboardSettings.aiPrompts ?? [];
  const [draft, setDraft] = useState<Draft | null>(null);
  const save = (next: ClipboardAiPrompt[]) => onChange({ ...clipboardSettings, aiPrompts: next });

  const commit = () => {
    if (!draft || !draft.title.trim() || !draft.prompt.trim()) return;
    const entry = { id: draft.id ?? newId(), title: draft.title.trim(), prompt: draft.prompt.trim() };
    save(draft.id ? prompts.map((prompt) => (prompt.id === draft.id ? entry : prompt)) : [...prompts, entry]);
    setDraft(null);
  };

  return (
    <SettingsGroup title={text.title}>
      <SettingsRow title={isMacOS ? text.hintTitleMac : text.hintTitle} description={text.hint} searchable={false} />
      {prompts.map((prompt) => (
        <SettingsRow
          key={prompt.id}
          title={prompt.title}
          description={prompt.prompt.length > 80 ? `${prompt.prompt.slice(0, 80)}…` : prompt.prompt}
          searchable={false}
          control={
            <div className="clipboard-snippet__actions">
              <button type="button" aria-label={text.edit(prompt.title)} onClick={() => setDraft({ id: prompt.id, title: prompt.title, prompt: prompt.prompt })}>
                <Pencil size={14} strokeWidth={1.5} absoluteStrokeWidth />
              </button>
              <button type="button" aria-label={text.remove(prompt.title)} onClick={() => save(prompts.filter((other) => other.id !== prompt.id))}>
                <Trash2 size={14} strokeWidth={1.5} absoluteStrokeWidth />
              </button>
            </div>
          }
        />
      ))}
      {draft ? (
        <SettingsRow title={draft.id ? text.editing : text.adding} searchable={false}>
          <div className="clipboard-snippet__form">
            <SettingsInput value={draft.title} maxLength={24} placeholder={text.titlePlaceholder} aria-label={text.titlePlaceholder} onChange={(event) => setDraft({ ...draft, title: event.currentTarget.value })} />
            <textarea
              className="clipboard-snippet__text"
              value={draft.prompt}
              rows={4}
              maxLength={2000}
              placeholder={text.promptPlaceholder}
              aria-label={text.promptPlaceholder}
              onChange={(event) => setDraft({ ...draft, prompt: event.currentTarget.value })}
            />
            <div className="clipboard-snippet__buttons">
              <button type="button" onClick={() => setDraft(null)}>{text.cancel}</button>
              <button type="button" className="clipboard-snippet__save" disabled={!draft.title.trim() || !draft.prompt.trim()} onClick={commit}>{text.save}</button>
            </div>
          </div>
        </SettingsRow>
      ) : prompts.length < 20 && (
        <SettingsRow
          title={text.add}
          searchable={false}
          control={
            <button type="button" className="clipboard-snippet__add" aria-label={text.add} onClick={() => setDraft({ id: null, title: "", prompt: "" })}>
              <Plus size={14} strokeWidth={1.5} absoluteStrokeWidth />
            </button>
          }
        />
      )}
    </SettingsGroup>
  );
}
