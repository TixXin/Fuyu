import { SettingsLinkButton } from "./SettingsLinkButton";
import { useTranslation } from "../../i18n";

export function FeaturePageLink({ page, onOpenPage }: { page: string; onOpenPage(page: string): void }) {
  const t = useTranslation();
  return <SettingsLinkButton onClick={() => onOpenPage(page)}>{t.settings.shortcuts.openFeaturePage}</SettingsLinkButton>;
}
