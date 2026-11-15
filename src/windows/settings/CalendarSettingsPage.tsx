import type { IslandSettings } from "../../features/appearance/types";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { CalendarSourcesSection } from "../../features/calendar/CalendarSourcesSection";
import { CALENDAR_REMIND_MINUTES, type CalendarRemindMinutes } from "../../features/calendar/calendarSettings";
import { useTranslation } from "../../i18n";
import { FeatureHeader } from "./FeatureHeader";

type CalendarSectionProps = {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
};

function IslandSection({ settings, onSettingsChange }: CalendarSectionProps) {
  const t = useTranslation();
  const text = t.settings.calendar;

  return (
    <SettingsGroup title={text.island}>
      <SettingsRow
        title={text.remind}
        description={text.remindHint}
        control={
          <SettingsSelect
            value={String(settings.calendarRemindMinutes)}
            ariaLabel={text.remind}
            options={CALENDAR_REMIND_MINUTES.map((minutes) => ({ value: String(minutes), label: text.remindOption(minutes) }))}
            onChange={(value) => onSettingsChange({ ...settings, calendarRemindMinutes: Number(value) as CalendarRemindMinutes })}
          />
        }
      />
      {settings.calendarRemindMinutes > 0 && (
        <SettingsToggleRow
          indent
          title={text.showTitle}
          description={text.showTitleHint}
          checked={settings.calendarShowTitle}
          onChange={(calendarShowTitle) => onSettingsChange({ ...settings, calendarShowTitle })}
        />
      )}
    </SettingsGroup>
  );
}

export function CalendarSettingsPage(props: CalendarSectionProps) {
  return (
    <>
      <FeatureHeader feature="calendar" />
      <IslandSection {...props} />
      <CalendarSourcesSection />
    </>
  );
}
