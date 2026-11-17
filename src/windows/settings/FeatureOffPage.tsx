import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { useTranslation } from "../../i18n";
import { FeatureHeader, type HeaderFeature } from "../../components/settings/FeatureHeader";
import { settingsCategoryIcon } from "../../features/plugin-kernel/settingsCategories";

export function FeatureOffPage({
  feature,
  onEnable,
  onOpenOverview,
}: {
  feature: Exclude<HeaderFeature, "messages">;
  onEnable?: () => void;
  onOpenOverview: () => void;
}) {
  const text = useTranslation().settings.modules;
  return (
    <div className="feature-off" data-feature={feature} data-search="off">
      <FeatureHeader feature={feature} icon={settingsCategoryIcon(feature)} off />
      <div className="feature-off__note">
        <p>{text.offNote}</p>
        <div className="feature-off__actions">
          {onEnable ? (
            <button className="feature-off__enable" type="button" onClick={onEnable}>
              {text.enableNow}
            </button>
          ) : null}
          <SettingsLinkButton onClick={onOpenOverview}>{text.toOverview}</SettingsLinkButton>
        </div>
      </div>
    </div>
  );
}
