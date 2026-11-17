import { useEffect, useState } from "react";
import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useTranslation } from "../../i18n";
import type { SyncStatus } from "./api";
import { SYNC_BACKENDS, SYNC_SECURITY_SECTIONS, type SyncBackendId } from "./syncBackends";

const CONFIRM_MS = 4_000;

export function SyncBackendSection({
  status,
  busy,
  onChooseFolder,
  onRevealFolder,
  onStopSync,
}: {
  status: SyncStatus;
  busy: boolean;
  onChooseFolder: (pickerTitle: string) => void;
  onRevealFolder: () => void;
  onStopSync: () => void;
}) {
  const text = useTranslation().sync.backend;
  const [selectedBackend, setSelectedBackend] = useState<SyncBackendId>("folder");
  const [confirmingStop, setConfirmingStop] = useState(false);

  useEffect(() => {
    if (!confirmingStop) return;
    const timer = window.setTimeout(() => setConfirmingStop(false), CONFIRM_MS);
    return () => window.clearTimeout(timer);
  }, [confirmingStop]);

  const activeEntry = SYNC_BACKENDS.find((entry) => entry.id === selectedBackend) ?? SYNC_BACKENDS[0];
  const ExtraBackend = activeEntry?.component;

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
                onChange={setSelectedBackend}
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
                  <SettingsLinkButton disabled={busy} onClick={() => onChooseFolder(text.folderPickerTitle)}>
                    {text.changeFolder}
                  </SettingsLinkButton>
                  {confirmingStop ? (
                    <>
                      <SettingsLinkButton onClick={() => setConfirmingStop(false)}>{text.stopCancel}</SettingsLinkButton>
                      <SettingsLinkButton
                        tone="danger"
                        disabled={busy}
                        onClick={() => {
                          setConfirmingStop(false);
                          onStopSync();
                        }}
                      >
                        {text.stopConfirm}
                      </SettingsLinkButton>
                    </>
                  ) : (
                    <SettingsLinkButton tone="danger" disabled={busy} onClick={() => setConfirmingStop(true)}>
                      {text.stopSync}
                    </SettingsLinkButton>
                  )}
                </div>
              ) : (
                <SettingsLinkButton disabled={busy} onClick={() => onChooseFolder(text.folderPickerTitle)}>
                  {text.chooseFolder}
                </SettingsLinkButton>
              )
            }
          />
        ) : ExtraBackend ? (
          <ExtraBackend status={status} busy={busy} />
        ) : null}
      </SettingsGroup>

      {SYNC_SECURITY_SECTIONS.map((Section, index) => (
        <Section key={index} status={status} busy={busy} />
      ))}
    </>
  );
}
