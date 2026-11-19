import { ExternalLink } from "lucide-react";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { useFlash } from "../../components/settings/useFlash";
import { useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import { openLocalApiDocs, type LocalApiInfo } from "./api";
import { localApiExample } from "./example.ts";
import { LocalApiCopyButton } from "./LocalApiCopyButton";
import "./LocalApiExample.css";

export function LocalApiExample({ info, notify }: { info: LocalApiInfo; notify: boolean }) {
  const t = useTranslation().settings.localApi;
  const [copied, flashCopied] = useFlash<true>();
  const example = localApiExample({ url: info.url, configPath: info.configPath, windows: !isMacOS, notify });
  const openDocs = () => void openLocalApiDocs().catch((error: unknown) => console.error("Could not open the local API docs", error));
  const copy = () => void navigator.clipboard.writeText(example).then(() => flashCopied(true), () => flashCopied(null));

  return (
    <SettingsGroup
      title={t.tryTitle}
      action={
        <SettingsLinkButton onClick={openDocs}>
          {t.docs} <ExternalLink size={12} strokeWidth={2.2} aria-hidden="true" />
        </SettingsLinkButton>
      }
      footer={<SettingsFootnote text={notify ? t.tryNotifyHint : t.tryHint} />}
    >
      <div className="local-api-example" data-search="off">
        <pre className="local-api-example__code">{example}</pre>
        <LocalApiCopyButton copied={copied === true} onClick={copy} />
      </div>
    </SettingsGroup>
  );
}
