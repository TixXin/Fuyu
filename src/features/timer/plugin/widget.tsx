import { useEffect, useState } from "react";
import { BellRing, Timer as TimerIcon, Watch } from "lucide-react";
import { WidgetEmpty, WidgetFrame } from "../../../components/island-widget/WidgetFrame";
import { useTranslation } from "../../../i18n";
import { visibilityInterval } from "../../../lib/useVisibilityInterval";
import { defineSlot, type IslandWidgetMeta, type IslandWidgetProps } from "../../plugin-kernel/slots";
import { requestTimerPage, useTimers } from "../store";
import { clockText, shownMs, shownTimer } from "../timers";
import { TIMER_WIDGET } from "./widgets.ts";
import "./widget.css";

const widgetSlot = defineSlot<IslandWidgetProps, IslandWidgetMeta>("island.widget/v1");

function TimerWidget() {
  const t = useTranslation();
  const { timers } = useTimers();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => visibilityInterval(() => setNow(Date.now()), 500), []);
  const timer = shownTimer(timers, now);
  const Icon = timer?.alerted ? BellRing : timer?.kind === "stopwatch" ? Watch : TimerIcon;
  return (
    <WidgetFrame icon={Icon} title={t.islandWidgets.widgets.timer}>
      {timer ? (
        <button className="timer-widget" type="button" aria-label={t.timer.chip} onClick={(event) => { event.stopPropagation(); requestTimerPage(false); }}>
          <span className="island-widget__big">{clockText(shownMs(timer, now), timer.kind === "countdown")}</span>
        </button>
      ) : (
        <WidgetEmpty>{t.islandWidgets.content.noTimers}</WidgetEmpty>
      )}
    </WidgetFrame>
  );
}

widgetSlot.add({ ...TIMER_WIDGET, component: TimerWidget }, TIMER_WIDGET.owner);
