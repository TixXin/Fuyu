import { useId } from "react";
import { Cable, FileCode2, FolderOpen, Globe, KeyRound, Lock, RefreshCw, ShieldCheck } from "lucide-react";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsDisabledArea, SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsIconTitle } from "../../components/settings/SettingsIconTitle";
import { SettingsInlineConfirm } from "../../components/settings/SettingsInlineConfirm";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsStatusCard, type StatusCardTone } from "../../components/settings/SettingsStatusCard";
import { SettingsSwitch } from "../../components/settings/SettingsSwitch";
import { useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import type { SettingsLink } from "../plugin-kernel/settingsCategories";
import type { LocalApiInfo } from "./api";
import { LocalApiAccess } from "./LocalApiAccess";
import { LocalApiCopyButton } from "./LocalApiCopyButton";
import { LocalApiExample } from "./LocalApiExample";
import { LocalApiSenders } from "./LocalApiSenders";

export type LocalApiCopied = "address" | "token";

export function LocalApiPageView({
  enabled,
  info,
  error,
  failure,
  allowWrite,
  allowNotify,
  copied,
  onToggleEnabled,
  onAllowWriteChange,
  onAllowNotifyChange,
  onCopyAddress,
  onCopyToken,
  onResetToken,
  onRevealConfig,
  onOpenDocs,
  onOpenPage,
}: {
  enabled: boolean;
  info: LocalApiInfo | null;
  error: string | null;
  failure: string | null;
  allowWrite: boolean;
  allowNotify: boolean;
  copied: LocalApiCopied | null;
  onToggleEnabled: (next: boolean) => void;
  onAllowWriteChange: (next: boolean) => void;
  onAllowNotifyChange: (next: boolean) => void;
  onCopyAddress: () => void;
  onCopyToken: () => void;
  onResetToken: () => void;
  onRevealConfig: () => void;
  onOpenDocs: () => void;
  onOpenPage: (page: SettingsLink) => void;
}) {
  const settingsText = useTranslation().settings;
  const t = settingsText.localApi;
  const dataHome = settingsText.dataHome;
  const switchId = useId();
  const running = enabled && info?.running === true;
  const alert = failure ?? error;

  const tone: StatusCardTone = !enabled ? "off" : alert ? "error" : running ? "ok" : "warn";
  const badgeLabel = !enabled ? t.statusOff : alert ? t.statusError : running ? t.statusRunning : t.notRunning;
  const addressText = !enabled ? t.addressOff : running && info ? info.url : t.notRunning;
  const configPathText = enabled && info?.configPath ? info.configPath : "local-api.json";

  return (
    <>
      <SettingsStatusCard
        tone={tone}
        icon={<Cable size={20} strokeWidth={1.9} />}
        title={t.title}
        badge={{ label: badgeLabel, tone }}
        description={t.heroHint}
        meta={
          <>
            <span className="settings-status-card__pill">
              <Lock size={11} strokeWidth={2.2} aria-hidden="true" />
              {t.localOnlyBadge}
            </span>
            <span className="settings-status-card__pill">
              <ShieldCheck size={11} strokeWidth={2.2} aria-hidden="true" />
              {t.tokenProtectedBadge}
            </span>
          </>
        }
        control={<SettingsSwitch id={switchId} ariaLabel={t.title} checked={enabled} onChange={onToggleEnabled} />}
        alert={alert}
      />

      <SettingsDisabledArea disabled={!enabled}>
        <SettingsGroup title={t.connectionTitle} footer={<SettingsFootnote text={t.connectionHint} />}>
          <SettingsRow
            title={<SettingsIconTitle icon={<Globe size={14} strokeWidth={2} />}>{t.address}</SettingsIconTitle>}
            description={<span className={running ? "settings-row__mono" : undefined}>{addressText}</span>}
            since="off"
            control={<LocalApiCopyButton copied={copied === "address"} disabled={!running} onClick={onCopyAddress} />}
          />
          <SettingsRow
            title={<SettingsIconTitle icon={<KeyRound size={14} strokeWidth={2} />}>{t.token}</SettingsIconTitle>}
            description={t.tokenHint}
            since="off"
            control={<LocalApiCopyButton copied={copied === "token"} disabled={!enabled} onClick={onCopyToken} />}
          />
          <SettingsRow
            title={<SettingsIconTitle icon={<RefreshCw size={14} strokeWidth={2} />}>{t.resetToken}</SettingsIconTitle>}
            description={t.resetTokenHint}
            since="off"
            control={
              <SettingsInlineConfirm
                tone="danger"
                disabled={!enabled}
                confirmLabel={t.resetTokenConfirm}
                hint={t.resetTokenHint}
                onConfirm={onResetToken}
              >
                {t.resetToken}
              </SettingsInlineConfirm>
            }
          />
          <SettingsRow
            title={<SettingsIconTitle icon={<FileCode2 size={14} strokeWidth={2} />}>{t.configFile}</SettingsIconTitle>}
            description={<span className="settings-row__mono">{configPathText}</span>}
            searchable={false}
            control={
              <SettingsLinkButton disabled={!enabled || !info?.configPath} onClick={onRevealConfig}>
                <FolderOpen size={13} strokeWidth={2.2} aria-hidden="true" />
                {isMacOS ? dataHome.revealMac : dataHome.reveal}
              </SettingsLinkButton>
            }
          />
        </SettingsGroup>

        <LocalApiAccess
          allowWrite={allowWrite}
          allowNotify={allowNotify}
          disabled={!enabled}
          onAllowWriteChange={onAllowWriteChange}
          onAllowNotifyChange={onAllowNotifyChange}
          onOpenPage={onOpenPage}
        />

        <LocalApiSenders disabled={!enabled} />

        <LocalApiExample info={enabled ? info : null} notify={allowNotify} disabled={!enabled} onOpenDocs={onOpenDocs} />
      </SettingsDisabledArea>
    </>
  );
}
