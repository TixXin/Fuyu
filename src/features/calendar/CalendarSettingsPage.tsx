import type { IslandSettings } from "../../lib/settings/types";
import { FeatureHeader } from "../../components/settings/FeatureHeader";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";
import { SlotView } from "../plugin-kernel/SlotView";
import { settingsCategoryIcon } from "../plugin-kernel/settingsCategories";
import { settingsSections } from "../plugin-kernel/settingsSlots";
import { CalendarAlertsSection } from "./CalendarAlertsSection";
import { CalendarPanelPrefsSection } from "./CalendarPanelPrefsSection";
import { CalendarSourcesSection } from "./CalendarSourcesSection";
import {
  CALENDAR_HOLD_MINUTES,
  COUNTDOWN_FORMATS,
  COUNTDOWN_SCOPES,
  type CalendarHoldMinutes,
  type CountdownFormat,
  type CountdownScope,
} from "./calendarPrefs";
import { CALENDAR_REMIND_MINUTES, type CalendarRemindMinutes } from "./calendarSettings";
import { useCalendarPrefs } from "./useCalendarPrefs";

type CalendarSectionProps = {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
};

function IslandSection({ settings, onSettingsChange }: CalendarSectionProps) {
  const text = useTranslation().settings.calendar;
  const [prefs, setPrefs] = useCalendarPrefs();

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
        <>
          <SettingsRow
            indent
            title={text.countdownScope}
            description={text.countdownScopeHint}
            control={
              <SettingsSelect
                value={prefs.countdownScope}
                ariaLabel={text.countdownScope}
                options={COUNTDOWN_SCOPES.map((scope) => ({ value: scope, label: text.countdownScopes[scope] }))}
                onChange={(countdownScope) => setPrefs({ ...prefs, countdownScope: countdownScope as CountdownScope })}
              />
            }
          />
          <SettingsRow
            indent
            title={text.countdownFormat}
            description={text.countdownFormatHint}
            control={
              <SettingsSelect
                value={prefs.countdownFormat}
                ariaLabel={text.countdownFormat}
                options={COUNTDOWN_FORMATS.map((format) => ({ value: format, label: text.countdownFormats[format] }))}
                onChange={(countdownFormat) => setPrefs({ ...prefs, countdownFormat: countdownFormat as CountdownFormat })}
              />
            }
          />
          <SettingsToggleRow
            indent
            title={text.showTitle}
            description={text.showTitleHint}
            checked={settings.calendarShowTitle}
            onChange={(calendarShowTitle) => onSettingsChange({ ...settings, calendarShowTitle })}
          />
          <SettingsRow
            indent
            title={text.holdMinutes}
            description={text.holdMinutesHint}
            control={
              <SettingsSelect
                value={String(prefs.holdMinutes)}
                ariaLabel={text.holdMinutes}
                options={CALENDAR_HOLD_MINUTES.map((minutes) => ({ value: String(minutes), label: text.holdOption(minutes) }))}
                onChange={(value) => setPrefs({ ...prefs, holdMinutes: Number(value) as CalendarHoldMinutes })}
              />
            }
          />
        </>
      )}
    </SettingsGroup>
  );
}

const sections = settingsSections<CalendarSectionProps, "calendar">();

sections.add({ id: "calendar.island", category: "calendar", order: 10, component: IslandSection });
sections.add({ id: "calendar.alerts", category: "calendar", order: 15, component: CalendarAlertsSection });
sections.add({ id: "calendar.panel", category: "calendar", order: 18, component: CalendarPanelPrefsSection });
sections.add({ id: "calendar.sources", category: "calendar", order: 20, component: CalendarSourcesSection });

export function CalendarSettingsPage(props: CalendarSectionProps) {
  return (
    <>
      <FeatureHeader feature="calendar" icon={settingsCategoryIcon("calendar")} />
      <SlotView slot={sections} group="calendar" props={props} />
    </>
  );
}
