import { useRef, type ChangeEvent, type ReactNode } from "react";
import { Download, FolderOpen, RotateCw, Upload } from "lucide-react";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useErrorText, useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import { restartIsland, revealBackup, saveSettingsBackup } from "./api";
import { backupFileName, parseBackup } from "./backup.ts";
import { collectBackup, restoreBackup } from "./storage.ts";
import "./SettingsBackupSection.css";

type Status =
  | { kind: "saved"; path: string }
  | { kind: "restored"; count: number }
  | { kind: "error"; message: string };

export function SettingsBackupSection({ onNote }: { onNote: (note: ReactNode) => void }) {
  const t = useTranslation();
  const errorText = useErrorText();
  const text = t.settings.backup;
  const fileInput = useRef<HTMLInputElement>(null);

  const note = (status: Status) => (
    <>
      {status.kind === "saved" && (
        <p className="settings-backup__status" role="status">
          <span>{text.saved(status.path)}</span>
          <button className="settings-backup__link" type="button" onClick={() => void revealBackup(status.path)}>
            <FolderOpen size={12} strokeWidth={2.2} aria-hidden="true" />
            {isMacOS ? text.revealMac : text.reveal}
          </button>
        </p>
      )}
      {status.kind === "restored" && (
        <p className="settings-backup__status" role="status">
          <span>{text.restored(status.count)}</span>
          <button className="settings-backup__link" type="button" onClick={() => void restartIsland()}>
            <RotateCw size={12} strokeWidth={2.2} aria-hidden="true" />
            {text.restart}
          </button>
        </p>
      )}
      {status.kind === "error" && (
        <p className="settings-backup__status settings-backup__status--error" role="alert">{status.message}</p>
      )}
    </>
  );
  const setStatus = (status: Status) => onNote(note(status));

  const save = () => {
    const now = new Date();
    void saveSettingsBackup(backupFileName(now), JSON.stringify(collectBackup(now), null, 2))
      .then((path) => setStatus({ kind: "saved", path }))
      .catch((error: unknown) => setStatus({ kind: "error", message: errorText(error) }));
  };

  const restore = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    const parsed = parseBackup(await file.text());
    if ("problem" in parsed) {
      setStatus({ kind: "error", message: text.problems[parsed.problem] });
      return;
    }
    if (!window.confirm(text.confirmRestore)) return;
    setStatus({ kind: "restored", count: restoreBackup(parsed.keys) });
  };

  return (
    <>
      <SettingsRow
        title={text.save}
        control={
          <SettingsLinkButton onClick={save}>
            <Download size={13} strokeWidth={2.2} aria-hidden="true" />
            {text.saveAction}
          </SettingsLinkButton>
        }
      />
      <SettingsRow
        title={text.restore}
        control={
          <>
            <SettingsLinkButton onClick={() => fileInput.current?.click()}>
              <Upload size={13} strokeWidth={2.2} aria-hidden="true" />
              {text.restoreAction}
            </SettingsLinkButton>
            <input
              ref={fileInput}
              className="settings-backup__file"
              type="file"
              accept=".json,application/json"
              aria-label={text.restore}
              onChange={(event) => void restore(event)}
            />
          </>
        }
      />
    </>
  );
}
