import type { CSSProperties } from "react";
import { BellRing, Pause, Play, Plus, Timer as TimerIcon, Watch, X } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { etaClockText, progressOf, sortPanelTimers, TIMER_PRESETS } from "../timerLayout.ts";
import { clockText, EXTEND_MS, isFinished, MAX_TIMERS, shownMs, type Timer } from "../timers.ts";
import { TimerInputForm, TimerLayoutMenu, useOwnerName } from "./TimerChrome";
import type { TimerLayoutProps } from "./types.ts";
import "./GridLayout.css";

const ONE_MINUTE_MS = 60_000;
const MIN_GRID_SLOTS = 6;

function GridActiveTile({
  timer,
  now,
  onToggle,
  onExtend,
  onCancel,
}: {
  timer: Timer;
  now: number;
  onToggle: (timer: Timer) => void;
  onExtend: (timer: Timer, addMs: number) => void;
  onCancel: (id: string) => void;
}) {
  const t = useTranslation().timer;
  const ownerName = useOwnerName(timer.owner);
  const done = isFinished(timer, now);
  const running = timer.runningSince !== null;
  const ms = shownMs(timer, now);
  const Icon = done ? BellRing : timer.kind === "countdown" ? TimerIcon : Watch;
  const fillPct = timer.kind === "countdown" ? (done ? 100 : (1 - progressOf(timer, now)) * 100) : 100;
  const label = done ? t.ended : timer.kind === "countdown" ? clockText(timer.durationMs, true) : t.stopwatchLabel;

  return (
    <div className={`timer-grid__tile timer-panel__row${done ? " timer-panel__row--done" : ""}${running || done ? "" : " timer-panel__row--paused"}`}>
      <span className="timer-grid__fill" style={{ "--timer-progress": `${fillPct.toFixed(1)}%` } as CSSProperties} aria-hidden="true" />
      <div className="timer-grid__head">
        <span className="timer-grid__tag">
          <Icon size={13} strokeWidth={2} aria-hidden="true" />
          <span className="timer-grid__tag-text">{label}</span>
          {ownerName && <span className="timer-panel__source">· {ownerName}</span>}
        </span>
        {!done && timer.kind === "countdown" && (
          <span className="timer-grid__eta">{running ? etaClockText(ms, now) : t.panel.pausedLabel}</span>
        )}
      </div>
      <div className="timer-grid__big timer-panel__time">{clockText(ms, timer.kind === "countdown")}</div>
      <div className="timer-grid__foot">
        <span>{done ? t.panel.ringingHint : timer.kind === "countdown" ? (running ? t.panel.runningLabel : t.panel.pausedLabel) : (running ? t.panel.stopwatchRunning : t.panel.pausedLabel)}</span>
        <span className="timer-panel__actions">
          {done ? (
            <button className="timer-panel__button timer-panel__button--solid" type="button" aria-label={t.extend} title={t.extend} onClick={() => onExtend(timer, EXTEND_MS)}>
              <Plus size={12} strokeWidth={2.4} aria-hidden="true" />
            </button>
          ) : (
            <button className="timer-panel__button" type="button" aria-label={running ? t.pause : t.resume} title={running ? t.pause : t.resume} onClick={() => onToggle(timer)}>
              {running ? <Pause size={12} strokeWidth={2.2} aria-hidden="true" /> : <Play size={12} strokeWidth={2.2} aria-hidden="true" />}
            </button>
          )}
          <button className="timer-panel__button timer-panel__button--ghost" type="button" aria-label={done ? t.dismiss : t.cancel} title={done ? t.dismiss : t.cancel} onClick={() => onCancel(timer.id)}>
            <X size={12} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </span>
      </div>
    </div>
  );
}

export function GridLayout(props: TimerLayoutProps) {
  const { timers, now, text, problem, layout, inputRef, onTextChange, onSubmit, onStartCountdown, onStartStopwatch, onToggle, onExtend, onCancel, onLayout } = props;
  const t = useTranslation().timer;
  const sorted = sortPanelTimers(timers, now);
  const fillerCount = Math.max(0, MIN_GRID_SLOTS - sorted.length);
  const fillers = TIMER_PRESETS.slice(0, fillerCount);

  return (
    <div className="timer-grid">
      <div className="timer-grid__top">
        <TimerInputForm text={text} problem={problem} inputRef={inputRef} onTextChange={onTextChange} onSubmit={onSubmit} />
        <button className="timer-panel__pill timer-panel__pill--soft timer-grid__sw" type="button" aria-label={t.stopwatch} onClick={onStartStopwatch}>
          <Watch size={13} strokeWidth={2.1} aria-hidden="true" />
          {t.stopwatchLabel}
        </button>
        <span className="timer-grid__count">{sorted.length}/{MAX_TIMERS}</span>
        <TimerLayoutMenu layout={layout} onLayout={onLayout} />
      </div>

      {problem && <p className="timer-panel__problem" role="alert">{problem}</p>}

      <div className="timer-grid__tiles">
        {sorted.map((timer) => (
          <GridActiveTile key={timer.id} timer={timer} now={now} onToggle={onToggle} onExtend={onExtend} onCancel={onCancel} />
        ))}
        {fillers.map((minutes) => (
          <button
            key={minutes}
            className="timer-grid__tile timer-grid__tile--preset"
            type="button"
            aria-label={t.quickStart(minutes)}
            onClick={() => onStartCountdown(minutes * ONE_MINUTE_MS)}
          >
            <div className="timer-grid__head">
              <span className="timer-grid__tag">
                <TimerIcon size={13} strokeWidth={2} aria-hidden="true" />
                <span>{t.panel.presetTags[minutes]}</span>
              </span>
              <span className="timer-grid__play-hint" aria-hidden="true">
                <Play size={10} strokeWidth={2.5} />
              </span>
            </div>
            <div className="timer-grid__big">{clockText(minutes * ONE_MINUTE_MS, true)}</div>
            <div className="timer-grid__foot">
              <span>{t.panel.tapToStart}</span>
              <span>{t.panel.minutesFull(minutes)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
