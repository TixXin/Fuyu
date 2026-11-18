import { useEffect, useState } from "react";
import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useTranslation } from "../../i18n";
import type { SyncStatus } from "./api";
import { SYNC_BACKENDS, SYNC_SECURITY_SECTIONS, type SyncBackendId } from "./syncBackends";
import { activeSyncBackend } from "./syncState";
import { SyncEncryptionSection } from "./SyncEncryptionSection";
import { SyncWebdavSection } from "./SyncWebdavSection";

const CONFIRM_MS = 4_000;

export function SyncBackendSection({
  status,
  busy,
  onChooseFolder,
  onRevealFolder,
  onSaveWebdav,
  onStopSync,
}: {
  status: SyncStatus;
  busy: boolean;
  onChooseFolder: (pickerTitle: string) => void;
  onRevealFolder: () => void;
  onSaveWebdav: (url: string, username: string, password: string | null) => Promise<boolean>;
  onStopSync: (forgetWebdav?: boolean) => void;
}) {
  const text = useTranslation().sync.backend;
  const [pickedBackend, setPickedBackend] = useState<SyncBackendId | null>(null);
  const [confirmingStop, setConfirmingStop] = useState(false);

  useEffect(() => {
    if (!confirmingStop) return;
    const timer = window.setTimeout(() => setConfirmingStop(false), CONFIRM_MS);
    return () => window.clearTimeout(timer);
  }, [confirmingStop]);

  const activeKind = activeSyncBackend(status);
  const selectedBackend: SyncBackendId = pickedBackend ?? (activeKind === "webdav" ? "webdav" : "folder");
  const activeEntry = SYNC_BACKENDS.find((entry) => entry.id === selectedBackend) ?? SYNC_BACKENDS[0];
  const ExtraBackend = activeEntry?.component;
  const isFolderActive = activeKind === "folder" && Boolean(status.folder);

  return (
    <>
      <SettingsGroup
        title={text.groupTitle}
        footer={<SettingsFootnote text={text.footnote} />}
      >
        {SYNC_BACKENDS.length > 1 ? (
          <SettingsRow
            title={text.methodLabel}
            control={
              <SettingsChoice<SyncBackendId>
                value={selectedBackend}
                ariaLabel={text.methodLabel}
                options={SYNC_BACKENDS.map((entry) => ({
                  value: entry.id,
                  label: text.methods[entry.id],
                }))}
                onChange={(next) => {
                  setConfirmingStop(false);
                  setPickedBackend(next);
                }}
              />
            }
          />
        ) : null}

        {selectedBackend === "folder" ? (
          <SettingsRow
            title={text.folderTitle}
            description={
              status.folder ? (
                <span className="sync-folder-path">{status.folder}</span>
              ) : (
                text.folderUnset
              )
            }
            control={
              status.folder ? (
                <div className="sync-folder-actions">
                  <SettingsLinkButton onClick={onRevealFolder}>{text.revealFolder}</SettingsLinkButton>
                  <SettingsLinkButton
                    disabled={busy}
                    onClick={() => {
                      setPickedBackend("folder");
                      onChooseFolder(text.folderPickerTitle);
                    }}
                  >
                    {text.changeFolder}
                  </SettingsLinkButton>
                  {isFolderActive ? (
                    confirmingStop ? (
                      <>
                        <SettingsLinkButton onClick={() => setConfirmingStop(false)}>{text.stopCancel}</SettingsLinkButton>
                        <SettingsLinkButton
                          tone="danger"
                          disabled={busy}
                          onClick={() => {
                            setConfirmingStop(false);
                            onStopSync(false);
                          }}
                        >
                          {text.stopConfirm}
                        </SettingsLinkButton>
                      </>
                    ) : (
                      <SettingsLinkButton tone="danger" disabled={busy} onClick={() => setConfirmingStop(true)}>
                        {text.stopSync}
                      </SettingsLinkButton>
                    )
                  ) : (
                    <SettingsLinkButton
                      disabled={busy}
                      onClick={() => {
                        setPickedBackend("folder");
                        onChooseFolder(text.folderPickerTitle);
                      }}
                    >
                      {text.chooseFolder}
                    </SettingsLinkButton>
                  )}
                </div>
              ) : (
                <SettingsLinkButton
                  disabled={busy}
                  onClick={() => {
                    setPickedBackend("folder");
                    onChooseFolder(text.folderPickerTitle);
                  }}
                >
                  {text.chooseFolder}
                </SettingsLinkButton>
              )
            }
          />
        ) : selectedBackend === "webdav" ? (
          <SyncWebdavSection
            status={status}
            busy={busy}
            onSaveWebdav={async (url, username, password) => {
              const ok = await onSaveWebdav(url, username, password);
              if (ok) setPickedBackend("webdav");
              return ok;
            }}
            onStopSync={onStopSync}
          />
        ) : ExtraBackend ? (
          <ExtraBackend status={status} busy={busy} />
        ) : null}
      </SettingsGroup>

      {SYNC_SECURITY_SECTIONS.map((entry) =>
        entry.id === "encryption" ? (
          <SyncEncryptionSection key={entry.id} status={status} busy={busy} />
        ) : entry.component ? (
          <entry.component key={entry.id} status={status} busy={busy} />
        ) : null,
      )}
    </>
  );
}
