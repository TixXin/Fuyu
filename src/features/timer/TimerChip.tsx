import { useEffect, useState } from "react";
import { BellRing, Timer as TimerIcon, Watch } from "lucide-react";
import { useTranslation } from "../../i18n";
import { requestTimerPage, useTimers } from "./store";
import { clockText, shownMs, shownTimer, type Timer } from "./timers";
import "./TimerChip.css";

export const TIMER_CHIP_WIDTH = 64;

export function hasChip(timers: readonly Timer[]): boolean {
  return timers.some((timer) => timer.runningSince !== null || timer.alerted);
}

export function TimerChip({ paused }: { paused: boolean }) {
  const t = useTranslation().timer;
  const { timers } = useTimers();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (paused) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [paused, timers]);
  const timer = shownTimer(timers, now);
  if (!timer) return null;
  const Icon = timer.alerted ? BellRing : timer.kind === "countdown" ? TimerIcon : Watch;
  return (
    <button
      className={`timer-chip${timer.alerted ? " timer-chip--done" : ""}`}
      type="button"
      title={t.chip}
      aria-label={t.chip}
      onClick={(event) => {
        event.stopPropagation();
        requestTimerPage(false);
      }}
    >
      <Icon size={11} strokeWidth={2.4} aria-hidden="true" />
      <span className="timer-chip__time">{clockText(shownMs(timer, now), timer.kind === "countdown")}</span>
    </button>
  );
}
