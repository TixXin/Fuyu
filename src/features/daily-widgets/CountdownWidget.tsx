import { useState } from "react";
import { PartyPopper, Pencil } from "lucide-react";
import { WidgetFrame } from "../../components/island-widget/WidgetFrame";
import { clickOnly } from "../../components/island-widget/clickOnly";
import { useLocale, useTranslation } from "../../i18n";
import { countdownTarget, daysBetween, isYearly } from "./countdowns.ts";
import { CountdownEditor } from "./CountdownEditor";
import { showNextCountdown } from "./customize.ts";
import { nextCountdown } from "./days.ts";
import { useDaily, useNow } from "./store.ts";

export function CountdownWidget() {
  const t = useTranslation().islandWidgets.daily;
  const { locale } = useLocale();
  const now = useNow(60_000);
  const data = useDaily();
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const entry = data.countdowns[data.countdownAt] ?? null;
  if (editing !== null) {
    return <CountdownEditor at={editing === "new" ? null : editing} entry={editing === "new" ? null : (data.countdowns[editing] ?? null)} count={data.countdowns.length} onEdit={setEditing} onClose={() => setEditing(null)} />;
  }
  const fallback = entry ? null : nextCountdown(now);
  const target = entry ? countdownTarget(entry.date, now) : (fallback?.date ?? now);
  const title = entry ? entry.name || t.countdownUntitled : t.countdownTo[fallback?.kind ?? "newYear"];
  const days = daysBetween(now, target);
  const several = data.countdowns.length > 1;
  const dateText = target.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
  const pencil = (
    <button className="daily-icon-button" type="button" aria-label={t.edit} title={t.edit} onClick={clickOnly(() => setEditing(entry ? data.countdownAt : "new"))}>
      <Pencil size={11} strokeWidth={2.2} />
    </button>
  );
  const body = (
    <>
      <div className="daily-fill" />
      <div className="daily-big daily-countdown__value" data-today={days === 0 || undefined}>
        {days === 0 ? t.isToday : Math.abs(days)}
        {days === 0 ? null : <span className="daily-unit daily-muted">{days < 0 ? t.daysAgo : t.days}</span>}
      </div>
      <div className="daily-small daily-muted daily-countdown__date">
        {entry && isYearly(entry.date) ? `${dateText} · ${t.everyYear}` : dateText}
      </div>
    </>
  );
  return (
    <WidgetFrame icon={PartyPopper} title={title} aside={pencil} className="daily-countdown">
      {several ? (
        <button className="daily-countdown__cycle" type="button" title={t.nextCountdown} onClick={clickOnly(showNextCountdown)}>
          {body}
          <span className="daily-countdown__dots" aria-hidden="true">
            {data.countdowns.map((item, at) => (
              <i key={`${at}-${item.date}`} data-on={at === data.countdownAt || undefined} />
            ))}
          </span>
        </button>
      ) : (
        body
      )}
    </WidgetFrame>
  );
}
