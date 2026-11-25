import { ExternalLink } from "lucide-react";
import { SettingsCodeBlock } from "../../components/settings/SettingsCodeBlock";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { useFlash } from "../../components/settings/useFlash";
import { useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import type { LocalApiInfo } from "./api";
import { localApiExample } from "./example.ts";
import { LocalApiCopyButton } from "./LocalApiCopyButton";

const FALLBACK_URL = "http://127.0.0.1:39271/v1";
const FALLBACK_CONFIG_MAC = "~/Library/Application Support/com.tixxin.fuyu/local-api.json";
const FALLBACK_CONFIG_WIN = "%APPDATA%\\com.tixxin.fuyu\\local-api.json";

export function LocalApiExample({
  info,
  notify,
  disabled = false,
  onOpenDocs,
}: {
  info: LocalApiInfo | null;
  notify: boolean;
  disabled?: boolean;
  onOpenDocs: () => void;
}) {
  const t = useTranslation().settings.localApi;
  const [copied, flashCopied] = useFlash<true>();
  const url = info?.url || FALLBACK_URL;
  const configPath = info?.configPath || (isMacOS ? FALLBACK_CONFIG_MAC : FALLBACK_CONFIG_WIN);
  const example = localApiExample({ url, configPath, windows: !isMacOS, notify });
  const copy = () => void navigator.clipboard.writeText(example).then(() => flashCopied(true), () => flashCopied(null));

  return (
    <SettingsGroup
      title={t.tryTitle}
      action={
        <SettingsLinkButton disabled={disabled} onClick={onOpenDocs}>
          {t.docs} <ExternalLink size={12} strokeWidth={2.2} aria-hidden="true" />
        </SettingsLinkButton>
      }
      footer={<SettingsFootnote text={disabled ? t.tryOffHint : notify ? t.tryNotifyHint : t.tryHint} />}
    >
      <SettingsCodeBlock
        label={isMacOS ? t.shellMac : t.shellWin}
        code={example}
        codeClassName="local-api-example__code"
        action={<LocalApiCopyButton copied={copied === true} disabled={disabled} onClick={copy} />}
      />
    </SettingsGroup>
  );
}
