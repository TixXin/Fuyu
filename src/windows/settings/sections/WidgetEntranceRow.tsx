import { useTranslation } from "../../../i18n";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsSelect } from "../../../components/settings/SettingsSelect";
import { WIDGET_ENTRANCES } from "../../../lib/theme/widgetEntrance";
import type { WidgetEntrance } from "../../../lib/settings/types";

export function WidgetEntranceRow({ value, onChange }: { value: WidgetEntrance; onChange: (value: WidgetEntrance) => void }) {
  const text = useTranslation().settings.expand;
  const options = WIDGET_ENTRANCES.map((entrance) => ({ value: entrance, label: text.widgetEntrances[entrance] }));
  return (
    <SettingsRow
      title={text.widgetEntrance}
      description={text.widgetEntranceHint}
      control={<SettingsSelect<WidgetEntrance> value={value} options={options} ariaLabel={text.widgetEntrance} onChange={onChange} />}
    />
  );
}
