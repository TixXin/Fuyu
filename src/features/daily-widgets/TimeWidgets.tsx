import { Globe, Hourglass, PartyPopper, Sunrise } from "lucide-react";
import { WidgetFrame } from "../../components/island-widget/WidgetFrame";
import { useLocale, useTranslation } from "../../i18n";
import { daysUntil, nextCountdown, yearProgress } from "./days.ts";
import { useNow } from "./store.ts";
import { minutesText, sunDay } from "./sun.ts";

const ZONES = [
  ["tokyo", "Asia/Tokyo"],
  ["london", "Europe/London"],
  ["newYork", "America/New_York"],
] as const;

export function YearWidget() {
  const now = useNow(60_000);
  const progress = yearProgress(now);
  return (
    <WidgetFrame icon={Hourglass} title={String(now.getFullYear())} className="daily-year">
      <div className="daily-fill" />
      <div className="daily-big daily-year__value">
        {Math.floor(progress * 100)}
        <span className="daily-unit">%</span>
      </div>
      <div className="daily-year__months" aria-hidden="true">
        {Array.from({ length: 12 }, (_, month) => (
          <i key={month} data-state={month < now.getMonth() ? "past" : month === now.getMonth() ? "now" : undefined} />
        ))}
      </div>
    </WidgetFrame>
  );
}

export function WorldClockWidget() {
  const t = useTranslation().islandWidgets.daily;
  const { locale } = useLocale();
  const now = useNow(10_000);
  return (
    <WidgetFrame icon={Globe} title={t.names.worldClock} className="daily-world">
      <div className="daily-world__rows">
        {ZONES.map(([city, zone]) => (
          <div key={zone} className="daily-world__row">
            <span className="daily-world__city">{t.cities[city]}</span>
            <span className="daily-big">{now.toLocaleTimeString(locale, { timeZone: zone, hour: "2-digit", minute: "2-digit", hour12: false })}</span>
          </div>
        ))}
      </div>
    </WidgetFrame>
  );
}

export function CountdownWidget() {
  const t = useTranslation().islandWidgets.daily;
  const { locale } = useLocale();
  const now = useNow(60_000);
  const next = nextCountdown(now);
  return (
    <WidgetFrame icon={PartyPopper} title={t.countdownTo[next.kind]} className="daily-countdown">
      <div className="daily-fill" />
      <div className="daily-big daily-countdown__value">
        {daysUntil(now, next.date)}
        <span className="daily-unit daily-muted">{t.days}</span>
      </div>
      <div className="daily-small daily-muted">{next.date.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" })}</div>
    </WidgetFrame>
  );
}

export function SunWidget() {
  const t = useTranslation().islandWidgets.daily;
  const now = useNow(60_000);
  const { rise, set } = sunDay(now);
  const minute = now.getHours() * 60 + now.getMinutes();
  const along = Math.min(1, Math.max(0, (minute - rise) / Math.max(1, set - rise)));
  const up = minute >= rise && minute <= set;
  const x = 10 + along * 76;
  const y = 46 - Math.sin(along * Math.PI) * 32;
  return (
    <WidgetFrame icon={Sunrise} title={t.names.sun} className="daily-sun">
      <svg className="daily-sun__arc" viewBox="0 6 96 44" aria-hidden="true">
        <path className="daily-sun__path" d="M10 46 Q48 -18 86 46" />
        <line className="daily-sun__horizon" x1="4" y1="46" x2="92" y2="46" />
        <circle className="daily-sun__dot" data-up={up || undefined} cx={x} cy={y} r="6" />
      </svg>
      <div className="daily-sun__times daily-small">
        <span title={t.sunrise}>{minutesText(rise)}</span>
        <span className="daily-muted" title={t.sunset}>
          {minutesText(set)}
        </span>
      </div>
    </WidgetFrame>
  );
}
