import { useEffect, useState } from "react";
import { BellRing, Timer as TimerIcon, Watch } from "lucide-react";
import { clickOnly } from "../../../components/island-widget/clickOnly";
import { WidgetFrame } from "../../../components/island-widget/WidgetFrame";
import { WidgetOpenButton } from "../../../components/island-widget/WidgetOpenButton";
import { useTranslation } from "../../../i18n";
import { panelInterval } from "../../../components/island-widget/panelAwake";
import { defineSlot, type IslandWidgetMeta, type IslandWidgetProps } from "../../plugin-kernel/slots";
import { requestTimerPage, startCountdown, useTimers } from "../store";
import { clockText, shownMs, shownTimer } from "../timers";
import { StopwatchWidget } from "./stopwatchWidget";
import { STOPWATCH_WIDGET, TIMER_WIDGET } from "./widgets.ts";
import "./widget.css";

const PRESET_MINUTES = [5, 15, 25] as const;

const widgetSlot = defineSlot<IslandWidgetProps, IslandWidgetMeta>("island.widget/v1");

const openTimers = () => requestTimerPage(false);

function TimerWidget() {
  const t = useTranslation();
  const { timers } = useTimers();
  const [now, setNow] = useState(() => Date.now());
  const [failed, setFailed] = useState(false);
  useEffect(() => panelInterval(() => setNow(Date.now()), 500), []);
  const timer = shownTimer(timers, now);
  const Icon = timer?.alerted ? BellRing : timer?.kind === "stopwatch" ? Watch : TimerIcon;
  const quickStart = (minutes: number) => {
    void startCountdown(minutes * 60_000).then((result) => setFailed(result !== "ok"));
  };
  return (
    <WidgetFrame icon={Icon} title={t.islandWidgets.widgets.timer} aside={<WidgetOpenButton label={t.timer.chip} onOpen={openTimers} />}>
      {timer ? (
        <button className="timer-widget" type="button" aria-label={t.timer.chip} onClick={clickOnly(openTimers)}>
          <span className="island-widget__big">{clockText(shownMs(timer, now), timer.kind === "countdown")}</span>
        </button>
      ) : (
        <div className="timer-widget__empty">
          <span className="island-widget__sub" title={failed ? t.timer.unavailable : undefined}>{failed ? t.timer.unavailable : t.islandWidgets.content.noTimers}</span>
          <span className="timer-widget__presets">
            {PRESET_MINUTES.map((minutes) => (
              <button key={minutes} type="button" aria-label={t.timer.quickStart(minutes)} title={t.timer.quickStart(minutes)} onClick={clickOnly(() => quickStart(minutes))}>
                {t.timer.quickPreset(minutes)}
              </button>
            ))}
          </span>
        </div>
      )}
    </WidgetFrame>
  );
}

widgetSlot.add({ ...TIMER_WIDGET, component: TimerWidget }, TIMER_WIDGET.owner);
widgetSlot.add({ ...STOPWATCH_WIDGET, component: StopwatchWidget }, STOPWATCH_WIDGET.owner);
