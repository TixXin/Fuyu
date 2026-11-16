import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { SettingsFootnote } from "../../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { useErrorText, useLocale, useTranslation } from "../../../i18n";
import { readString } from "../../../lib/storage.ts";
import { formatBytes } from "../../../utils/bytes";
import { listUpdateBackups, prepareUpdateBackupRestore, restartIsland, type UpdateBackup, type UpdateBackupList } from "../../../lib/settings-backup/api";
import { applySnapshot, settingsUnreadable } from "../../../lib/settings-backup/localSnapshot.ts";
import "./SettingsBackupSection.css";

export function UpdateBackupsSection() {
  const t = useTranslation();
  const { locale } = useLocale();
  const errorText = useErrorText();
  const text = t.settings.backup.updates;
  const [list, setList] = useState<UpdateBackupList | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listUpdateBackups()
      .then((next) => { if (alive) setList(next); })
      .catch((reason: unknown) => { if (alive) setError(errorText(reason)); });
    return () => { alive = false; };
  }, [errorText]);

  const time = (at: number) => new Date(at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });

  const restore = async (backup: UpdateBackup) => {
    if (!window.confirm(text.confirmRestore(backup.fromVersion, time(backup.createdAt)))) return;
    setRestoring(backup.id);
    setError(null);
    try {
      applySnapshot(window.localStorage, await prepareUpdateBackupRestore(backup.id));
      await restartIsland();
    } catch (reason) {
      setError(errorText(reason));
      setRestoring(null);
    }
  };

  const backups = list?.backups ?? [];
  const broken = backups.length > 0 && ((list?.brokenFiles.length ?? 0) > 0 || settingsUnreadable(readString("fuyu-settings")));

  return (
    <SettingsGroup
      title={text.title}
      footer={
        <>
          {broken && <p className="settings-backup__status settings-backup__status--error" role="alert">{text.broken}</p>}
          {broken && (list?.brokenFiles.length ?? 0) > 0 && <SettingsFootnote text={text.brokenFiles(list?.brokenFiles.join(", ") ?? "")} />}
          <SettingsFootnote text={text.hint} />
          {list?.pendingRestore && <p className="settings-backup__status" role="status">{text.pending}</p>}
          {error && <p className="settings-backup__status settings-backup__status--error" role="alert">{error}</p>}
        </>
      }
    >
      {list !== null && backups.length === 0 && <SettingsRow title={text.none} searchable={false} />}
      {backups.map((backup) => (
        <SettingsRow
          key={backup.id}
          searchable={false}
          title={text.item(backup.fromVersion, backup.toVersion)}
          description={text.meta(time(backup.createdAt), formatBytes(backup.size), backup.files)}
          control={
            <SettingsLinkButton onClick={() => void restore(backup)} disabled={restoring !== null}>
              <RotateCcw size={13} strokeWidth={2.2} aria-hidden="true" />
              {restoring === backup.id ? text.restoring : text.restoreAction}
            </SettingsLinkButton>
          }
        />
      ))}
    </SettingsGroup>
  );
}
