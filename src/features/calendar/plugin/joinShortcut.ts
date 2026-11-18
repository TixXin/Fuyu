export const CALENDAR_JOIN_SHORTCUT_KEY = "joinShortcut";
export const SUGGESTED_CALENDAR_SHORTCUT = "Alt+Shift+J";

export function readCalendarJoinShortcut(config: Readonly<Record<string, unknown>>): string {
  const value = config[CALENDAR_JOIN_SHORTCUT_KEY];
  return typeof value === "string" ? value.trim() : "";
}

export function calendarShortcutConfigValue(next: string): string | null {
  const trimmed = next.trim();
  return trimmed ? trimmed : null;
}

export function resolveJoinShortcutTarget(options: {
  enabled: boolean;
  upcoming: { event: { meetingLink: string | null } } | null;
  pauseMediaOnJoin: boolean;
}): { link: string; pauseMedia: boolean } | null {
  if (!options.enabled) return null;
  const link = options.upcoming?.event.meetingLink?.trim();
  if (!link) return null;
  return { link, pauseMedia: options.pauseMediaOnJoin };
}
