import type { CommonText } from "../../i18n/sections/common";

const pad = (value: number) => String(value).padStart(2, "0");

export type AgeText = Pick<CommonText["ago"], "justNow" | "minutes" | "hours" | "days">;

export function formatAge(ms: number, text: AgeText) {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return text.justNow;
  if (minutes < 60) return text.minutes(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return text.hours(hours);
  return text.days(Math.floor(hours / 24));
}

export function formatAgo(time: number, now: number, text: CommonText["ago"]) {
  const minutes = Math.floor((now - time) / 60_000);
  if (minutes < 60) return formatAge(now - time, text);
  const then = new Date(time);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (then.getTime() >= today.getTime()) return text.hours(Math.floor(minutes / 60));
  if (then.getTime() >= today.getTime() - 86_400_000) return text.yesterday(`${pad(then.getHours())}:${pad(then.getMinutes())}`);
  return text.date(then.getMonth() + 1, then.getDate());
}
