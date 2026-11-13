import { useCallback, useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import { Download, FolderOpen, Trash2, Upload } from "lucide-react";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useErrorText, useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import { revealThemeFile } from "./api";
import type { ThemeProblem } from "./theme.ts";
import type { IslandPreset } from "./types";
import "./PresetSettingsSection.css";

type Status =
  | { kind: "idle" }
  | { kind: "exported"; path: string }
  | { kind: "imported"; name: string }
  | { kind: "error"; message: string };

export function PresetSettingsSection({
  presets,
  onSavePreset,
  onApplyPreset,
  onRenamePreset,
  onDeletePreset,
  onExportPreset,
  onImportPreset,
}: {
  presets: IslandPreset[];
  onSavePreset: () => void;
  onApplyPreset: (presetId: string) => void;
  onRenamePreset: (presetId: string, name: string) => void;
  onDeletePreset: (presetId: string) => void;
  onExportPreset: (presetId: string) => Promise<string>;
  onImportPreset: (text: string) => { name: string } | { problem: ThemeProblem };
}) {
  const t = useTranslation();
  const errorText = useErrorText();
  const text = t.settings.presets;
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [presetNameDraft, setPresetNameDraft] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const exportPreset = (presetId: string) => {
    void onExportPreset(presetId)
      .then((path) => setStatus({ kind: "exported", path }))
      .catch((error: unknown) => setStatus({ kind: "error", message: errorText(error) }));
  };

  const importTheme = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    const result = onImportPreset(await file.text());
    setStatus("problem" in result ? { kind: "error", message: text.problems[result.problem] } : { kind: "imported", name: result.name });
  };

  const commitPresetRename = useCallback(() => {
    if (!editingPresetId) {
      return;
    }
    onRenamePreset(editingPresetId, presetNameDraft);
    setEditingPresetId(null);
    setPresetNameDraft("");
  }, [editingPresetId, onRenamePreset, presetNameDraft]);

  const name = (preset: IslandPreset) =>
    editingPresetId === preset.id ? (
      <input
        className="preset-name-input"
        value={presetNameDraft}
        aria-label={text.nameLabel}
        autoFocus
        onChange={(event) => setPresetNameDraft(event.currentTarget.value)}
        onBlur={commitPresetRename}
        onKeyDown={(event) => {
          if (event.key === "Enter") commitPresetRename();
          if (event.key === "Escape") {
            setEditingPresetId(null);
            setPresetNameDraft("");
          }
        }}
      />
    ) : (
      <button
        className="preset-name-button"
        type="button"
        disabled={preset.isDefault}
        onClick={() => {
          setEditingPresetId(preset.id);
          setPresetNameDraft(preset.name);
        }}
      >
        {preset.name}
      </button>
    );

  const actions = (
    <span className="preset-actions">
      <SettingsLinkButton onClick={() => fileInput.current?.click()}>
        <Upload size={13} strokeWidth={2.2} aria-hidden="true" />
        {text.import}
      </SettingsLinkButton>
      <input
        ref={fileInput}
        className="preset-file-input"
        type="file"
        accept=".json,application/json"
        aria-label={text.import}
        onChange={(event) => void importTheme(event)}
      />
      <SettingsLinkButton onClick={onSavePreset}>{text.saveCurrent}</SettingsLinkButton>
    </span>
  );

  const footer = (
    <>
      <SettingsFootnote text={text.hint} />
      {status.kind === "exported" && (
        <p className="preset-status" role="status">
          <span>{text.exported(status.path)}</span>
          <button className="preset-status-link" type="button" onClick={() => void revealThemeFile(status.path)}>
            <FolderOpen size={12} strokeWidth={2.2} aria-hidden="true" />
            {isMacOS ? text.revealMac : text.reveal}
          </button>
        </p>
      )}
      {status.kind === "imported" && (
        <p className="preset-status" role="status">{text.imported(status.name)}</p>
      )}
      {status.kind === "error" && (
        <p className="preset-status preset-status--error" role="alert">{status.message}</p>
      )}
    </>
  );

  return (
    <SettingsGroup title={text.title} action={actions} footer={footer}>
      {presets.length === 0 ? (
        <SettingsRow searchable={false} title={<span className="preset-empty">{text.empty}</span>} />
      ) : (
        <div className="preset-grid">
          {presets.map((preset) => (
            <div className="preset-card" key={preset.id}>
              <span
                className="preset-card__thumb"
                aria-hidden="true"
                style={{
                  "--preset-fill": preset.settings.islandBackgroundColor,
                  "--preset-dot": preset.settings.pulseColor,
                  "--preset-text": preset.settings.taskTextColor,
                  "--preset-radius": `${Math.min(preset.settings.islandCornerRadius, 22) / 2}px`,
                } as CSSProperties}
              >
                <span className="preset-card__island"><i /><b /></span>
              </span>
              <span className="preset-card__name">{name(preset)}</span>
              <span className="preset-actions">
                <SettingsLinkButton onClick={() => onApplyPreset(preset.id)}>{text.apply}</SettingsLinkButton>
                <button
                  className="preset-icon-button"
                  type="button"
                  title={text.exportNamed(preset.name)}
                  aria-label={text.exportNamed(preset.name)}
                  onClick={() => exportPreset(preset.id)}
                >
                  <Download size={14} strokeWidth={2} />
                </button>
                {!preset.isDefault && (
                  <button
                    className="preset-icon-button"
                    type="button"
                    aria-label={text.deleteNamed(preset.name)}
                    onClick={() => onDeletePreset(preset.id)}
                  >
                    <Trash2 size={14} strokeWidth={2} />
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </SettingsGroup>
  );
}
