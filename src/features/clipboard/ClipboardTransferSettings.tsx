import { useRef, useState, type ChangeEvent } from "react";
import { Download, Upload } from "lucide-react";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useErrorText, useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import { exportClipboardHistory, importClipboardHistory, revealExportedFile } from "./api";

type Status = { kind: "exported"; path: string } | { kind: "imported"; items: number; snippets: number } | { kind: "error"; message: string } | null;

export function ClipboardTransferSettings() {
  const t = useTranslation();
  const errorText = useErrorText();
  const text = t.settings.clipboard.transfer;
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const exportNow = () => {
    setBusy(true);
    void exportClipboardHistory()
      .then((path) => setStatus({ kind: "exported", path }))
      .catch((error: unknown) => setStatus({ kind: "error", message: errorText(error) }))
      .finally(() => setBusy(false));
  };

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const report = await importClipboardHistory(await file.text());
      setStatus({ kind: "imported", ...report });
    } catch (error) {
      setStatus({ kind: "error", message: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsGroup title={text.title}>
      <SettingsRow
        title={text.export}
        description={text.exportHint}
        control={
          <SettingsLinkButton onClick={exportNow} disabled={busy}>
            <Download size={13} strokeWidth={2.2} aria-hidden="true" />
            {text.exportAction}
          </SettingsLinkButton>
        }
      />
      <SettingsRow
        title={text.import}
        description={text.importHint}
        control={
          <>
            <SettingsLinkButton onClick={() => fileInput.current?.click()} disabled={busy}>
              <Upload size={13} strokeWidth={2.2} aria-hidden="true" />
              {text.importAction}
            </SettingsLinkButton>
            <input ref={fileInput} hidden type="file" accept=".json,application/json" aria-label={text.import} onChange={(event) => void importFile(event)} />
          </>
        }
      />
      {status && (
        <SettingsRow
          searchable={false}
          title={status.kind === "error" ? text.failed : status.kind === "exported" ? text.exported : text.imported(status.items, status.snippets)}
          description={status.kind === "error" ? status.message : status.kind === "exported" ? status.path : undefined}
          control={status.kind === "exported" && (
            <SettingsLinkButton onClick={() => void revealExportedFile(status.path)}>{isMacOS ? text.showMac : text.show}</SettingsLinkButton>
          )}
        />
      )}
    </SettingsGroup>
  );
}
