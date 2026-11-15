import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { useTranslation } from "../../i18n";
import { FeatureHeader, type HeaderFeature } from "./FeatureHeader";

export function FeatureOffPage({ feature, onOpenOverview }: { feature: Exclude<HeaderFeature, "messages">; onOpenOverview: () => void }) {
  const text = useTranslation().settings.modules;
  return (
    <div className="feature-off" data-feature={feature} data-search="off">
      <FeatureHeader feature={feature} off />
      <div className="feature-off__note">
        <p>{text.offNote}</p>
        <SettingsLinkButton onClick={onOpenOverview}>{text.toOverview}</SettingsLinkButton>
      </div>
    </div>
  );
}
