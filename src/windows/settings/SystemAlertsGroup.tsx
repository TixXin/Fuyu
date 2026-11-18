import { BatteryCharging, Camera, Volume2 } from "lucide-react";
import { SettingsIconTitle } from "../../components/settings/SettingsIconTitle";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { isBuiltinEnabled, switchBuiltinPlugin } from "../../features/plugin-kernel/builtinSwitches";
import { useBuiltinPlugins } from "../../features/plugin-kernel/useBuiltinPlugins";
import type { IslandSettings } from "../../lib/settings/types";
import { useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";

export function SystemAlertsGroup({ settings }: { settings: IslandSettings; onSettingsChange?: (settings: IslandSettings) => void }) {
  const text = useTranslation().settings;
  const plugins = useBuiltinPlugins();
  const toggle = (id: string, on: boolean) => {
    void switchBuiltinPlugin(id, on).catch((error: unknown) => console.error(`Could not switch the ${id} plugin`, error));
  };
  const icon = { size: 15, strokeWidth: 1.9 };

  return (
    <SettingsGroup title={text.expand.alertsTitle}>
      <SettingsToggleRow
        title={<SettingsIconTitle icon={<Volume2 {...icon} />}>{text.levelPopup.title}</SettingsIconTitle>}
        description={isMacOS ? text.levelPopup.popupHintMac : text.levelPopup.popupHint}
        checked={isBuiltinEnabled(plugins, "system-levels", settings.levelPopup)}
        onChange={(on) => toggle("system-levels", on)}
      />
      <SettingsToggleRow
        title={<SettingsIconTitle icon={<BatteryCharging {...icon} />}>{text.deviceAlerts.title}</SettingsIconTitle>}
        description={isMacOS ? text.deviceAlerts.alertsHintMac : text.deviceAlerts.alertsHint}
        checked={isBuiltinEnabled(plugins, "device-events", settings.deviceAlerts)}
        onChange={(on) => toggle("device-events", on)}
      />
      <SettingsToggleRow
        title={<SettingsIconTitle icon={<Camera {...icon} />}>{text.deviceUse.indicator}</SettingsIconTitle>}
        description={text.deviceUse.indicatorHint}
        checked={isBuiltinEnabled(plugins, "device-use", settings.deviceUseIndicator)}
        onChange={(on) => toggle("device-use", on)}
      />
    </SettingsGroup>
  );
}
