import { Hourglass } from "lucide-react";
import { WidgetFrame } from "../../components/island-widget/WidgetFrame";
import { useTranslation } from "../../i18n";
import { yearProgress } from "./days.ts";
import { useNow } from "./store.ts";

export function YearWidget() {
  const t = useTranslation().islandWidgets.daily;
  const now = useNow(60_000);
  const progress = yearProgress(now);
  const end = new Date(now.getFullYear() + 1, 0, 1);
  const left = Math.ceil((end.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86_400_000);
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
      <div className="daily-small daily-muted">{t.daysLeft(left)}</div>
    </WidgetFrame>
  );
}
