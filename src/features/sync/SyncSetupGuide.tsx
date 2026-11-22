import { useId, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsSwitch } from "../../components/settings/SettingsSwitch";
import { useErrorText, useTranslation } from "../../i18n";
import type { SyncStatus } from "./api";
import { SYNC_BACKENDS, type SyncBackendId } from "./syncBackends";
import { SyncWebdavSection } from "./SyncWebdavSection";
import "./SyncSetupGuide.css";

type StepState = "done" | "current" | "next";

function SyncGuideStep({ index, state, title, description, control, children }: {
  index: number;
  state: StepState;
  title: string;
  description: string;
  control?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className={`settings-row sync-guide__step sync-guide__step--${state}`} aria-current={state === "current" ? "step" : undefined}>
      <div className="sync-guide__head">
        <span className="sync-guide__num" aria-hidden="true">
          {state === "done" ? <Check size={13} strokeWidth={2.6} /> : index}
        </span>
        <div className="settings-row__main">
          <div className="settings-row__text">
            <span className="settings-row__title">{title}</span>
            <span className="settings-row__description">{description}</span>
          </div>
          {control ? <div className="settings-row__control">{control}</div> : null}
        </div>
      </div>
      {children ? <div className="sync-guide__body">{children}</div> : null}
    </li>
  );
}

export function SyncSetupGuide({
  status,
  busy,
  actionError,
  wantEncryption,
  onWantEncryption,
  onChooseFolder,
  onSaveWebdav,
  onStopSync,
}: {
  status: SyncStatus;
  busy: boolean;
  actionError: unknown;
  wantEncryption: boolean;
  onWantEncryption: (next: boolean) => void;
  onChooseFolder: (pickerTitle: string) => void;
  onSaveWebdav: (url: string, username: string, password: string | null) => Promise<boolean>;
  onStopSync: (forgetWebdav?: boolean) => void;
}) {
  const t = useTranslation();
  const errorText = useErrorText();
  const text = t.sync.guide;
  const backend = t.sync.backend;
  const [method, setMethod] = useState<SyncBackendId>(status.webdav ? "webdav" : "folder");
  const error = actionError ?? status.error ?? null;
  const switchId = useId();

  return (
    <SettingsGroup title={text.groupTitle} footer={<SettingsFootnote text={backend.footnote} />}>
      <div className="sync-guide">
        <ol className="sync-guide__steps">
          <SyncGuideStep
            index={1}
            state="done"
            title={text.methodTitle}
            description={text.methodHint}
            control={
              <SettingsChoice<SyncBackendId>
                value={method}
                ariaLabel={backend.methodLabel}
                options={SYNC_BACKENDS.map((entry) => ({ value: entry.id, label: backend.methods[entry.id] }))}
                onChange={setMethod}
              />
            }
          />
          {method === "folder" ? (
            <SyncGuideStep
              index={2}
              state="current"
              title={text.folderTitle}
              description={text.folderHint}
              control={
                <SettingsLinkButton disabled={busy} onClick={() => onChooseFolder(backend.folderPickerTitle)}>
                  {backend.chooseFolder}
                </SettingsLinkButton>
              }
            />
          ) : (
            <SyncGuideStep index={2} state="current" title={text.webdavTitle} description={text.webdavHint}>
              <SyncWebdavSection status={status} busy={busy} onSaveWebdav={onSaveWebdav} onStopSync={onStopSync} />
            </SyncGuideStep>
          )}
          <SyncGuideStep
            index={3}
            state="next"
            title={text.encryptionTitle}
            description={text.encryptionHint}
            control={
              <SettingsSwitch
                id={switchId}
                checked={wantEncryption}
                ariaLabel={text.encryptionTitle}
                onChange={onWantEncryption}
              />
            }
          />
        </ol>
        {error !== null ? <p className="sync-status__error" role="alert">{errorText(error)}</p> : null}
        <p className="sync-guide__later">{text.later}</p>
      </div>
    </SettingsGroup>
  );
}
