import { BatteryMedium } from "lucide-react";
import { WidgetEmpty, WidgetFrame } from "../../components/island-widget/WidgetFrame";
import { useTranslation } from "../../i18n";
import { batteryIcon, isLowBattery } from "./batteryLook";
import { usePeripheralBatteries } from "./batteryStore";
import "./peripheralBattery.css";

export function PeripheralBatteryWidget() {
  const t = useTranslation().islandWidgets;
  const { list, loaded } = usePeripheralBatteries();
  return (
    <WidgetFrame icon={BatteryMedium} title={t.widgets.peripherals} className="peripheral-battery">
      {list.length > 0 ? (
        <ul className="peripheral-battery__list">
          {list.map((item) => {
            const Icon = batteryIcon(item.kind);
            const low = isLowBattery(item.battery) || undefined;
            return (
              <li key={item.id} className="peripheral-battery__row" title={t.content.peripheralLevel(item.name, item.battery)} data-low={low}>
                <Icon className="peripheral-battery__icon" size={13} strokeWidth={2.2} aria-hidden="true" />
                <span className="peripheral-battery__name">{item.name}</span>
                <span className="peripheral-battery__level">{item.battery}%</span>
                <span className="peripheral-battery__bar" aria-hidden="true">
                  <b style={{ width: `${item.battery}%` }} />
                </span>
              </li>
            );
          })}
        </ul>
      ) : loaded ? (
        <WidgetEmpty>{t.content.noPeripherals}</WidgetEmpty>
      ) : null}
    </WidgetFrame>
  );
}
