import type { ReactNode } from "react";
import { BatteryCharging, Camera, Volume2 } from "lucide-react";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import type { IslandSettings } from "../../features/appearance/types";
import { useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import "./SystemAlertsGroup.css";

function Title({ icon, children }: { icon: ReactNode; children: string }) {
  return <span className="system-alert-title"><span className="system-alert-title__icon" aria-hidden="true">{icon}</span>{children}</span>;
}

export function SystemAlertsGroup({ settings, onSettingsChange }: { settings: IslandSettings; onSettingsChange: (settings: IslandSettings) => void }) {
  const text = useTranslation().settings;
  const update = (patch: Partial<IslandSettings>) => onSettingsChange({ ...settings, ...patch });
  const icon = { size: 15, strokeWidth: 1.9 };

  return (
    <SettingsGroup title={text.expand.alertsTitle}>
      <SettingsToggleRow
        title={<Title icon={<Volume2 {...icon} />}>{text.levelPopup.title}</Title>}
        description={isMacOS ? text.levelPopup.popupHintMac : text.levelPopup.popupHint}
        checked={settings.levelPopup}
        onChange={(levelPopup) => update({ levelPopup })}
      />
      <SettingsToggleRow
        title={<Title icon={<BatteryCharging {...icon} />}>{text.deviceAlerts.title}</Title>}
        description={isMacOS ? text.deviceAlerts.alertsHintMac : text.deviceAlerts.alertsHint}
        checked={settings.deviceAlerts}
        onChange={(deviceAlerts) => update({ deviceAlerts })}
      />
      <SettingsToggleRow
        title={<Title icon={<Camera {...icon} />}>{text.deviceUse.indicator}</Title>}
        description={text.deviceUse.indicatorHint}
        checked={settings.deviceUseIndicator}
        onChange={(deviceUseIndicator) => update({ deviceUseIndicator })}
      />
    </SettingsGroup>
  );
}
