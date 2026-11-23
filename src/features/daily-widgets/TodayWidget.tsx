import { JellyfishMark } from "../../components/jellyfish/JellyfishMark";
import { useLocale, useTranslation } from "../../i18n";
import type { DailyWidgetsText } from "../../i18n/sections/dailyWidgets";
import { dayKey, focusText } from "./days.ts";
import { useDaily, useNow } from "./store.ts";

function greetingOf(hour: number): keyof DailyWidgetsText["greetings"] {
  if (hour < 6 || hour >= 23) return "night";
  if (hour < 11) return "morning";
  if (hour < 14) return "noon";
  if (hour < 18) return "afternoon";
  return "evening";
}

export function TodayWidget() {
  const t = useTranslation().islandWidgets.daily;
  const { locale } = useLocale();
  const now = useNow(1000);
  const data = useDaily();
  const today = dayKey(now);
  const greeting = greetingOf(now.getHours());
  const time = now.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: false });
  const date = now.toLocaleDateString(locale, { month: "long", day: "numeric", weekday: "short" });
  return (
    <div className="island-widget daily-today">
      <div className="daily-today__date">{date}</div>
      <div className="daily-today__clock daily-big">{time}</div>
      <div className="daily-today__foot">
        <JellyfishMark mood={greeting === "night" ? "done" : "idle"} height={40} lively />
        <div className="daily-today__words">
          <div className="daily-today__greeting">{t.greetings[greeting]}</div>
          <div className="daily-muted daily-small">{t.todaySummary(focusText(data.focus[today] ?? 0), data.water[today] ?? 0)}</div>
        </div>
      </div>
    </div>
  );
}
