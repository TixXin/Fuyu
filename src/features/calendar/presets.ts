import type { CalendarSourceKind } from "./api";

export type CalendarService = "feishu" | "dingtalk" | "wecom" | "icloud" | "google" | "outlook" | "other";

export type CalendarPreset = {
  service: CalendarService;
  kind: CalendarSourceKind;
  server: string;
};

export const CALENDAR_PRESETS: readonly CalendarPreset[] = [
  { service: "feishu", kind: "caldav", server: "https://caldav.feishu.cn" },
  { service: "dingtalk", kind: "caldav", server: "https://calendar.dingtalk.com" },
  { service: "wecom", kind: "caldav", server: "" },
  { service: "icloud", kind: "caldav", server: "https://caldav.icloud.com" },
  { service: "google", kind: "ics", server: "" },
  { service: "outlook", kind: "ics", server: "" },
  { service: "other", kind: "caldav", server: "" },
];

export function presetOf(service: CalendarService): CalendarPreset {
  return CALENDAR_PRESETS.find((preset) => preset.service === service) ?? CALENDAR_PRESETS[CALENDAR_PRESETS.length - 1];
}

export function needsServer(preset: CalendarPreset, kind: CalendarSourceKind) {
  return kind === "caldav" && preset.server === "";
}

export const CHINA_HOLIDAYS_LINK = "https://calendars.icloud.com/holidays/cn_zh.ics";

export function guessKind(link: string): CalendarSourceKind {
  const text = link.trim().toLowerCase();
  return text.startsWith("webcal://") || text.includes(".ics") || text.includes("/ical/") ? "ics" : "caldav";
}
