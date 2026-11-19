import { useId } from "react";
import { Check, Copy, FolderOpen } from "lucide-react";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsInlineConfirm } from "../../components/settings/SettingsInlineConfirm";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSwitch } from "../../components/settings/SettingsSwitch";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useFlash } from "../../components/settings/useFlash";
import { useErrorText, useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import { revealFolder } from "../../lib/settings-backup/api";
import { setBuiltinConfig, switchBuiltinPlugin } from "../plugin-kernel/builtinSwitches";
import { copyLocalApiToken } from "./api";
import { OWNER } from "./plugin/owner.ts";
import { useLocalApiInfo } from "./useLocalApiInfo";

type Copied = "address" | "token";

function CopyButton({ copied, label, copiedLabel, onClick }: { copied: boolean; label: string; copiedLabel: string; onClick: () => void }) {
  return (
    <SettingsLinkButton onClick={onClick}>
      {copied ? <Check size={12} strokeWidth={2.6} /> : <Copy size={12} strokeWidth={2.4} />} {copied ? copiedLabel : label}
    </SettingsLinkButton>
  );
}

export function LocalApiSettings() {
  const settingsText = useTranslation().settings;
  const t = settingsText.localApi;
  const dataHome = settingsText.dataHome;
  const errorText = useErrorText();
  const { info, error, allowWrite, resetToken } = useLocalApiInfo();
  const switchId = useId();
  const [copied, flashCopied] = useFlash<Copied>();
  const [failure, flashFailure] = useFlash<string>();

  const saveAllowWrite = (next: boolean) => {
    void setBuiltinConfig(OWNER, "allowWrite", next || null).catch((reason: unknown) => flashFailure(errorText(reason)));
  };
  const copy = (what: Copied, write: () => Promise<void>) => {
    void write().then(() => flashCopied(what), (reason: unknown) => flashFailure(errorText(reason)));
  };
  const address = info?.running ? info.url : t.notRunning;

  return (
    <SettingsGroup
      title={t.title}
      action={<SettingsSwitch id={switchId} ariaLabel={t.title} checked onChange={(on) => void switchBuiltinPlugin(OWNER, on).catch((reason: unknown) => flashFailure(errorText(reason)))} />}
      footer={<SettingsFootnote text={failure ?? error ?? t.hint} />}
    >
      <SettingsToggleRow title={t.allowWrite} description={t.allowWriteHint} checked={allowWrite} onChange={saveAllowWrite} />
      <SettingsRow
        title={t.address}
        description={address}
        control={info?.running ? <CopyButton copied={copied === "address"} label={t.copy} copiedLabel={t.copied} onClick={() => copy("address", () => navigator.clipboard.writeText(info.url))} /> : null}
      />
      <SettingsRow
        title={t.token}
        description={t.tokenHint}
        control={<CopyButton copied={copied === "token"} label={t.copy} copiedLabel={t.copied} onClick={() => copy("token", copyLocalApiToken)} />}
      />
      <SettingsRow
        title={t.resetToken}
        description={t.resetTokenHint}
        control={
          <SettingsInlineConfirm tone="danger" confirmLabel={t.resetTokenConfirm} hint={t.resetTokenHint} onConfirm={() => void resetToken()}>
            {t.resetToken}
          </SettingsInlineConfirm>
        }
      />
      <SettingsRow
        title={t.configFile}
        description={info?.configPath ?? ""}
        searchable={false}
        control={info?.configPath ? (
          <SettingsLinkButton onClick={() => void revealFolder(info.configPath)}>
            <FolderOpen size={13} strokeWidth={2.2} aria-hidden="true" />
            {isMacOS ? dataHome.revealMac : dataHome.reveal}
          </SettingsLinkButton>
        ) : null}
      />
    </SettingsGroup>
  );
}
