import { BatteryMedium } from "lucide-react";
import { SettingsIconTitle } from "../../components/settings/SettingsIconTitle";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { PERIPHERAL_BATTERY_ITEM } from "../../features/peripheral-battery/plugin/islandState";
import { PERIPHERAL_BATTERY_WIDGET } from "../../features/peripheral-battery/plugin/widgets";
import { skipMissingBattery, useHasBattery } from "../../features/system-widgets/batteryPresence";
import { useTranslation } from "../../i18n";
import { arrangeCollapsedItems, isCollapsedItemHidden, setCollapsedItemHidden } from "../../lib/settings/collapsedItems";
import { addPanelItem, fuyuPanel, fuyuPanels, removePanelItem } from "../../lib/settings/customPanels";
import { useCollapsedPlacements } from "../../lib/settings/useCollapsedPlacements";
import { useCustomPanels } from "../../lib/settings/useCustomPanels";
import { isMacOS } from "../../lib/platform";
import { useWidgetLibrary } from "./island-layout/useWidgetLibrary";

const WIDGET = PERIPHERAL_BATTERY_WIDGET.id;

export function PeripheralBatteryRows() {
  const text = useTranslation().settings.deviceAlerts;
  const { panels, save: savePanels } = useCustomPanels();
  const { placements, save: savePlacements } = useCollapsedPlacements();
  const library = useWidgetLibrary();
  const sizesOf = skipMissingBattery((id: string) => {
    const widget = library.find(id);
    return widget?.available ? widget.sizes : null;
  }, useHasBattery());
  const panel = fuyuPanel(panels, library.widgets.length > 0 ? sizesOf : undefined);
  const onPanel = panel.items.some((item) => item.widget === WIDGET);
  const onBar = !isCollapsedItemHidden(placements, PERIPHERAL_BATTERY_ITEM);

  const setPanel = (on: boolean) => savePanels(fuyuPanels(on ? addPanelItem(panel, WIDGET, "s") : removePanelItem(panel, WIDGET)));
  const setBar = (on: boolean) => savePlacements(setCollapsedItemHidden(arrangeCollapsedItems([PERIPHERAL_BATTERY_ITEM], placements), PERIPHERAL_BATTERY_ITEM, !on));

  return (
    <>
      <SettingsToggleRow
        title={<SettingsIconTitle icon={<BatteryMedium size={15} strokeWidth={1.9} />}>{text.peripherals}</SettingsIconTitle>}
        description={isMacOS ? text.peripheralsHintMac : text.peripheralsHint}
        checked={onPanel}
        onChange={setPanel}
      />
      <SettingsToggleRow title={text.peripheralsBar} description={text.peripheralsBarHint} checked={onBar} indent onChange={setBar} />
    </>
  );
}
