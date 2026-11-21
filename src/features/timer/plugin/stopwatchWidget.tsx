import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw, Watch } from "lucide-react";
import { WidgetFrame } from "../../../components/island-widget/WidgetFrame";
import { useTranslation } from "../../../i18n";
import { panelInterval } from "../../../components/island-widget/panelAwake";
import { cancelTimer, pauseTimer, resumeTimer, startStopwatch, useTimers } from "../store";
import { clockText, elapsedOf, isShown } from "../timers";
import { clickOnly } from "../../../components/island-widget/clickOnly";

export function StopwatchWidget() {
  const t = useTranslation().islandWidgets;
  const { timers } = useTimers();
  const watch = [...timers].reverse().find((timer) => timer.kind === "stopwatch" && isShown(timer)) ?? null;
  const running = watch?.runningSince != null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => (running ? panelInterval(() => setNow(Date.now()), 100) : undefined), [running]);
  const shown = watch ? elapsedOf(watch, Math.max(now, watch.runningSince ?? 0)) : 0;
  const toggle = () => {
    if (!watch) void startStopwatch();
    else if (running) pauseTimer(watch.id);
    else resumeTimer(watch.id);
  };
  return (
    <WidgetFrame icon={Watch} title={t.widgets.stopwatch} className="stopwatch-widget">
      <div className="stopwatch-widget__fill" />
      <span className="island-widget__big stopwatch-widget__time">
        {clockText(shown, false)}
        <small>.{Math.floor((shown % 1000) / 100)}</small>
      </span>
      <div className="stopwatch-widget__buttons">
        <button className="stopwatch-widget__button" type="button" data-main="true" aria-label={running ? t.content.pause : t.content.start} title={running ? t.content.pause : t.content.start} onClick={clickOnly(toggle)}>
          {running ? <Pause size={12} strokeWidth={2.6} /> : <Play size={12} strokeWidth={2.6} />}
        </button>
        {watch ? (
          <button className="stopwatch-widget__button" type="button" aria-label={t.content.reset} title={t.content.reset} onClick={clickOnly(() => cancelTimer(watch.id))}>
            <RotateCcw size={12} strokeWidth={2.4} />
          </button>
        ) : null}
      </div>
    </WidgetFrame>
  );
}
