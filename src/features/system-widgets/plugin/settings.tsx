import { SettingsChoice } from "../../../components/settings/SettingsChoice";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../../i18n";
import { islandItemStyleId, islandItemStyles } from "../../plugin-kernel/settingsSlots";
import type { BatteryCollapsedMode } from "../batteryPrefs";
import { useBatteryPrefs } from "../useBatteryPrefs";
import { BATTERY_ITEM } from "./islandState";

function BatteryStyleRows() {
  const t = useTranslation().islandWidgets.system.battery;
  const [prefs, setPrefs] = useBatteryPrefs();
  const options: { value: BatteryCollapsedMode; label: string }[] = [
    { value: "percent", label: t.collapsedModes.percent },
    { value: "time", label: t.collapsedModes.time },
  ];

  return (
    <>
      <SettingsRow
        title={t.collapsedMode}
        description={t.collapsedModeHint}
        control={
          <SettingsChoice<BatteryCollapsedMode>
            value={prefs.collapsedMode}
            options={options}
            ariaLabel={t.collapsedMode}
            onChange={(collapsedMode) => setPrefs({ ...prefs, collapsedMode })}
          />
        }
      />
      <SettingsToggleRow
        title={t.showCurve}
        description={t.showCurveHint}
        checked={prefs.showCurve}
        onChange={(showCurve) => setPrefs({ ...prefs, showCurve })}
      />
    </>
  );
}

islandItemStyles.add({ id: islandItemStyleId(BATTERY_ITEM), category: "islandLayout", order: 10, component: BatteryStyleRows });
