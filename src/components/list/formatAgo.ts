import type { CommonText } from "../../i18n/sections/common";

const pad = (value: number) => String(value).padStart(2, "0");

export function formatAgo(time: number, now: number, text: CommonText["ago"]) {
  const minutes = Math.floor((now - time) / 60_000);
  if (minutes < 1) return text.justNow;
  if (minutes < 60) return text.minutes(minutes);
  const then = new Date(time);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (then.getTime() >= today.getTime()) return text.hours(Math.floor(minutes / 60));
  if (then.getTime() >= today.getTime() - 86_400_000) return text.yesterday(`${pad(then.getHours())}:${pad(then.getMinutes())}`);
  return text.date(then.getMonth() + 1, then.getDate());
}
