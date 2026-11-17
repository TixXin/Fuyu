import { Check, Copy, FolderOpen } from "lucide-react";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useFlash } from "../../components/settings/useFlash";
import { useErrorText, useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import { revealFolder } from "../../lib/settings-backup/api";
import { setBuiltinConfig } from "../plugin-kernel/builtinSwitches";
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
    <SettingsGroup title={t.title} footer={failure ?? error ?? t.hint}>
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
      <SettingsRow title={t.resetToken} description={t.resetTokenHint} control={<SettingsLinkButton tone="danger" onClick={() => void resetToken()}>{t.resetToken}</SettingsLinkButton>} />
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
