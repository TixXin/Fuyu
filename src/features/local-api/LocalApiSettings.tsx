import { useId } from "react";
import { FolderOpen } from "lucide-react";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsInlineConfirm } from "../../components/settings/SettingsInlineConfirm";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSwitch } from "../../components/settings/SettingsSwitch";
import { useFlash } from "../../components/settings/useFlash";
import { useErrorText, useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import { revealFolder } from "../../lib/settings-backup/api";
import { setBuiltinConfig, switchBuiltinPlugin } from "../plugin-kernel/builtinSwitches";
import type { SettingsLink } from "../plugin-kernel/settingsCategories";
import { copyLocalApiToken } from "./api";
import { LocalApiAccess } from "./LocalApiAccess";
import { LocalApiCopyButton } from "./LocalApiCopyButton";
import { LocalApiExample } from "./LocalApiExample";
import { OWNER } from "./plugin/owner.ts";
import { useLocalApiInfo } from "./useLocalApiInfo";

type Copied = "address" | "token";

export type LocalApiSettingsProps = { onOpenPage: (page: SettingsLink) => void };

export function LocalApiSettings({ onOpenPage }: LocalApiSettingsProps) {
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
    <>
      <SettingsGroup
        title={t.title}
        action={<SettingsSwitch id={switchId} ariaLabel={t.title} checked onChange={(on) => void switchBuiltinPlugin(OWNER, on).catch((reason: unknown) => flashFailure(errorText(reason)))} />}
        footer={<SettingsFootnote text={failure ?? error ?? t.hint} />}
      >
        <SettingsRow
          title={t.address}
          description={address}
          control={info?.running ? <LocalApiCopyButton copied={copied === "address"} onClick={() => copy("address", () => navigator.clipboard.writeText(info.url))} /> : null}
        />
        <SettingsRow
          title={t.token}
          description={t.tokenHint}
          control={<LocalApiCopyButton copied={copied === "token"} onClick={() => copy("token", copyLocalApiToken)} />}
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
      <LocalApiAccess allowWrite={allowWrite} onAllowWriteChange={saveAllowWrite} onOpenPage={onOpenPage} />
      {info?.running ? <LocalApiExample info={info} /> : null}
    </>
  );
}
