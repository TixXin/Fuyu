import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { useTranslation } from "../../i18n";
import type { SettingsCategory } from "./categories";

export function FeaturePageLink({ page, onOpenPage }: { page: SettingsCategory; onOpenPage: (page: SettingsCategory) => void }) {
  const t = useTranslation();
  return <SettingsLinkButton onClick={() => onOpenPage(page)}>{t.settings.shortcuts.openFeaturePage}</SettingsLinkButton>;
}
