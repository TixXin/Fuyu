export const CALENDAR_REMIND_MINUTES = [0, 5, 10, 15, 30] as const;
export type CalendarRemindMinutes = (typeof CALENDAR_REMIND_MINUTES)[number];

export type CalendarSettingValues = {
  calendarEnabled: boolean;
  calendarRemindMinutes: CalendarRemindMinutes;
  calendarShowTitle: boolean;
};

export const DEFAULT_CALENDAR_SETTINGS: CalendarSettingValues = {
  calendarEnabled: true,
  calendarRemindMinutes: 10,
  calendarShowTitle: true,
};

export function normalizeCalendarSettings(saved: Partial<Record<keyof CalendarSettingValues, unknown>> | null | undefined): CalendarSettingValues {
  const minutes = saved?.calendarRemindMinutes;
  return {
    calendarEnabled: saved?.calendarEnabled !== false,
    calendarRemindMinutes: (CALENDAR_REMIND_MINUTES as readonly unknown[]).includes(minutes)
      ? (minutes as CalendarRemindMinutes)
      : DEFAULT_CALENDAR_SETTINGS.calendarRemindMinutes,
    calendarShowTitle: saved?.calendarShowTitle !== false,
  };
}
