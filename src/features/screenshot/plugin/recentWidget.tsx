import { useEffect, useState } from "react";
import { Images, Scissors } from "lucide-react";
import { WidgetFrame } from "../../../components/island-widget/WidgetFrame";
import { formatAgo } from "../../../components/list/formatAgo";
import { useTranslation } from "../../../i18n";
import { panelInterval } from "../../../components/island-widget/panelAwake";
import { copyHistoryScreenshot, startScreenshot } from "../api";
import { useScreenshotHistory } from "../useScreenshotHistory";
import "./recentWidget.css";
import { clickOnly } from "../../../components/island-widget/clickOnly";

export function RecentScreenshotWidget() {
  const t = useTranslation();
  const text = t.islandWidgets;
  const { items } = useScreenshotHistory();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => panelInterval(() => setNow(Date.now()), 30_000), []);
  const latest = items?.reduce<(typeof items)[number] | null>((best, item) => (!best || item.takenAt > best.takenAt ? item : best), null) ?? null;
  const take = clickOnly(() => void startScreenshot("region").catch((failure: unknown) => console.error("Failed to start a screenshot", failure)));
  return (
    <WidgetFrame icon={Scissors} title={text.widgets.screenshot} aside={latest ? formatAgo(latest.takenAt, now, t.common.ago) : null} className="shot-widget">
      <div className="shot-widget__body">
        {latest ? (
          <button className="shot-widget__picture" type="button" aria-label={text.content.copyScreenshot} title={text.content.copyScreenshot} onClick={clickOnly(() => void copyHistoryScreenshot(latest.path).catch((failure: unknown) => console.error("Failed to copy the screenshot", failure)))}>
            {latest.thumbnail ? <img src={latest.thumbnail} alt="" draggable={false} /> : <Images size={20} aria-hidden="true" />}
          </button>
        ) : (
          <span className="island-widget__empty">{text.content.noScreenshots}</span>
        )}
        <button className="shot-widget__take" type="button" aria-label={text.content.takeScreenshot} title={text.content.takeScreenshot} onClick={take}>
          <Scissors size={12} strokeWidth={2.4} />
        </button>
      </div>
    </WidgetFrame>
  );
}
