import { Check, Copy } from "lucide-react";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { useTranslation } from "../../i18n";

export function LocalApiCopyButton({ copied, onClick }: { copied: boolean; onClick: () => void }) {
  const t = useTranslation().settings.localApi;
  return (
    <SettingsLinkButton onClick={onClick}>
      {copied ? <Check size={12} strokeWidth={2.6} /> : <Copy size={12} strokeWidth={2.4} />} {copied ? t.copied : t.copy}
    </SettingsLinkButton>
  );
}
