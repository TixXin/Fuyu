import { useFlash } from "../../components/settings/useFlash";
import { useErrorText } from "../../i18n";
import { revealFolder } from "../../lib/settings-backup/api";
import { setBuiltinConfig, switchBuiltinPlugin } from "../plugin-kernel/builtinSwitches";
import type { SettingsLink } from "../plugin-kernel/settingsCategories";
import { copyLocalApiToken, openLocalApiDocs } from "./api";
import { LocalApiPageView, type LocalApiCopied } from "./LocalApiPageView";
import { OWNER } from "./plugin/owner.ts";
import { useLocalApiInfo } from "./useLocalApiInfo";

export type LocalApiSettingsProps = { onOpenPage: (page: SettingsLink) => void };

export function LocalApiSettings({ onOpenPage }: LocalApiSettingsProps) {
  const errorText = useErrorText();
  const { info, error, allowWrite, allowNotify, resetToken } = useLocalApiInfo();
  const [copied, flashCopied] = useFlash<LocalApiCopied>();
  const [failure, flashFailure] = useFlash<string>();

  const saveSwitch = (key: "allowWrite" | "allowNotify") => (next: boolean) => {
    void setBuiltinConfig(OWNER, key, next || null).catch((reason: unknown) => flashFailure(errorText(reason)));
  };
  const copy = (what: LocalApiCopied, write: () => Promise<void>) => {
    void write().then(() => flashCopied(what), (reason: unknown) => flashFailure(errorText(reason)));
  };

  return (
    <LocalApiPageView
      enabled
      info={info}
      error={error}
      failure={failure}
      allowWrite={allowWrite}
      allowNotify={allowNotify}
      copied={copied}
      onToggleEnabled={(on) => void switchBuiltinPlugin(OWNER, on).catch((reason: unknown) => flashFailure(errorText(reason)))}
      onAllowWriteChange={saveSwitch("allowWrite")}
      onAllowNotifyChange={saveSwitch("allowNotify")}
      onCopyAddress={() => {
        if (info?.running) copy("address", () => navigator.clipboard.writeText(info.url));
      }}
      onCopyToken={() => copy("token", copyLocalApiToken)}
      onResetToken={() => void resetToken()}
      onRevealConfig={() => {
        if (info?.configPath) void revealFolder(info.configPath);
      }}
      onOpenDocs={() => void openLocalApiDocs().catch((reason: unknown) => console.error("Could not open the local API docs", reason))}
      onOpenPage={onOpenPage}
    />
  );
}
