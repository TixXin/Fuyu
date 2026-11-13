import { BatteryCharging, Camera, Volume2 } from "lucide-react";
import { SettingsIconTitle } from "../../components/settings/SettingsIconTitle";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import type { IslandSettings } from "../../features/appearance/types";
import { useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";

export function SystemAlertsGroup({ settings, onSettingsChange }: { settings: IslandSettings; onSettingsChange: (settings: IslandSettings) => void }) {
  const text = useTranslation().settings;
  const update = (patch: Partial<IslandSettings>) => onSettingsChange({ ...settings, ...patch });
  const icon = { size: 15, strokeWidth: 1.9 };

  return (
    <SettingsGroup title={text.expand.alertsTitle}>
      <SettingsToggleRow
        title={<SettingsIconTitle icon={<Volume2 {...icon} />}>{text.levelPopup.title}</SettingsIconTitle>}
        description={isMacOS ? text.levelPopup.popupHintMac : text.levelPopup.popupHint}
        checked={settings.levelPopup}
        onChange={(levelPopup) => update({ levelPopup })}
      />
      <SettingsToggleRow
        title={<SettingsIconTitle icon={<BatteryCharging {...icon} />}>{text.deviceAlerts.title}</SettingsIconTitle>}
        description={isMacOS ? text.deviceAlerts.alertsHintMac : text.deviceAlerts.alertsHint}
        checked={settings.deviceAlerts}
        onChange={(deviceAlerts) => update({ deviceAlerts })}
      />
      <SettingsToggleRow
        title={<SettingsIconTitle icon={<Camera {...icon} />}>{text.deviceUse.indicator}</SettingsIconTitle>}
        description={text.deviceUse.indicatorHint}
        checked={settings.deviceUseIndicator}
        onChange={(deviceUseIndicator) => update({ deviceUseIndicator })}
      />
    </SettingsGroup>
  );
}
