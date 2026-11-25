import { useState, type CSSProperties } from "react";
import { BellRing, Pause, Play, Plus, Timer as TimerIcon, Volume2, VolumeX, Watch, X } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { etaClockText, progressOf, sortPanelTimers, TIMER_PRESETS } from "../timerLayout.ts";
import { clockText, EXTEND_MS, isFinished, MAX_TIMERS, parseDuration, shownMs, type Timer } from "../timers.ts";
import { TimerCompactRow, TimerInputForm, TimerLayoutMenu, useOwnerName } from "./TimerChrome";
import type { TimerLayoutProps } from "./types.ts";
import "./SplitLayout.css";

const RING_RADIUS = 50;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const ONE_MINUTE_MS = 60_000;

function SplitHero({
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
  const label = timer.kind === "countdown" ? `${t.countdown} · ${clockText(timer.durationMs, true)}` : t.stopwatchLabel;
  const ratio = timer.kind === "countdown" ? (done ? 1 : 1 - progressOf(timer, now)) : (ms % ONE_MINUTE_MS) / ONE_MINUTE_MS;
  const dashOffset = RING_CIRCUMFERENCE * (1 - ratio);
  const statusText = done
    ? t.ended
    : running
      ? (timer.kind === "countdown" ? t.panel.remainingLabel : t.panel.elapsedLabel)
      : t.panel.pausedLabel;
  const metaText = done
    ? t.panel.ringingHint
    : timer.kind === "countdown"
      ? (running ? t.panel.etaAt(etaClockText(ms, now)) : t.panel.pausedLabel)
      : (running ? t.panel.stopwatchRunning : t.panel.stopwatchPaused);

  return (
    <div className={`timer-split__hero timer-panel__row${done ? " timer-panel__row--done" : ""}${running || done ? "" : " timer-panel__row--paused"}`}>
      <div className="timer-split__dial">
        <svg className="timer-split__dial-svg" viewBox="0 0 112 112" aria-hidden="true">
          <circle className="timer-split__dial-track" cx="56" cy="56" r={RING_RADIUS} />
          <circle
            className={`timer-split__dial-arc${!running && !done ? " timer-split__dial-arc--paused" : ""}`}
            cx="56"
            cy="56"
            r={RING_RADIUS}
            strokeDasharray={RING_CIRCUMFERENCE}
            style={{ "--timer-ring-offset": `${dashOffset}` } as CSSProperties}
          />
        </svg>
        <div className="timer-split__dial-center">
          <span className="timer-split__dial-time timer-panel__time">{clockText(ms, timer.kind === "countdown")}</span>
          <span className="timer-split__dial-sub">{statusText}</span>
        </div>
      </div>
      <div className="timer-split__hero-info">
        <div className="timer-split__hero-tag">
          <Icon size={14} strokeWidth={2} aria-hidden="true" />
          <strong className="timer-split__hero-title">{done ? t.ended : label}</strong>
          {ownerName && <span className="timer-panel__source timer-split__source-pill">{t.from(ownerName)}</span>}
        </div>
        <span className="timer-split__hero-meta">{metaText}</span>
        <div className="timer-split__hero-acts">
          {done ? (
            <>
              <button className="timer-panel__pill timer-panel__pill--accent" type="button" aria-label={t.extend} onClick={() => onExtend(timer, EXTEND_MS)}>
                <Plus size={12} strokeWidth={2.4} aria-hidden="true" />
                {t.extend}
              </button>
              <button className="timer-panel__pill" type="button" aria-label={t.dismiss} onClick={() => onCancel(timer.id)}>
                {t.dismiss}
              </button>
            </>
          ) : (
            <>
              <button
                className="timer-panel__pill timer-panel__pill--accent"
                type="button"
                aria-label={running ? t.pause : t.resume}
                onClick={() => onToggle(timer)}
              >
                {running ? <Pause size={12} strokeWidth={2.4} aria-hidden="true" /> : <Play size={12} strokeWidth={2.4} aria-hidden="true" />}
                {running ? t.pause : t.resume}
              </button>
              {timer.kind === "countdown" && (
                <>
                  <button className="timer-panel__pill timer-panel__pill--soft" type="button" onClick={() => onExtend(timer, ONE_MINUTE_MS)}>
                    {t.panel.addOneMin}
                  </button>
                  <button className="timer-panel__pill timer-panel__pill--soft" type="button" onClick={() => onExtend(timer, EXTEND_MS)}>
                    {t.panel.addFiveMin}
                  </button>
                </>
              )}
              <button className="timer-panel__icon-btn" type="button" aria-label={t.cancel} title={t.cancel} onClick={() => onCancel(timer.id)}>
                <X size={13} strokeWidth={2.2} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function SplitLayout(props: TimerLayoutProps) {
  const { timers, now, text, problem, layout, sound, inputRef, onTextChange, onSubmit, onStartCountdown, onStartStopwatch, onToggle, onExtend, onCancel, onLayout, onToggleSound } = props;
  const t = useTranslation().timer;
  const [standbyMin, setStandbyMin] = useState(5);
  const parsed = parseDuration(text);
  const sorted = sortPanelTimers(timers, now);
  const stopwatch = timers.find((item) => item.kind === "stopwatch");
  const previewMs = parsed ?? standbyMin * ONE_MINUTE_MS;
  const previewFrac = Math.min(1, Math.max(0.08, previewMs / (60 * ONE_MINUTE_MS)));
  const singleRinging = sorted.length === 1 && isFinished(sorted[0], now);
  const hasDue = sorted.some((item) => isFinished(item, now));

  const stepStandby = (delta: number) => setStandbyMin((current) => Math.min(180, Math.max(1, current + delta)));

  return (
    <div className="timer-split">
      <div className="timer-split__left">
        <TimerInputForm text={text} problem={problem} inputRef={inputRef} onTextChange={onTextChange} onSubmit={onSubmit} />
        {problem && <p className="timer-panel__problem" role="alert">{problem}</p>}
        <div className="timer-split__presets">
          {TIMER_PRESETS.map((minutes) => (
            <button
              key={minutes}
              className="timer-split__preset"
              type="button"
              aria-label={t.quickStart(minutes)}
              onClick={() => onStartCountdown(minutes * ONE_MINUTE_MS)}
            >
              <strong className="timer-split__preset-num">{t.quickPreset(minutes)}</strong>
              <span className="timer-split__preset-tag">{t.panel.presetTags[minutes]}</span>
            </button>
          ))}
        </div>
        <div className="timer-split__foot">
          <button className="timer-split__sw-btn" type="button" aria-label={t.stopwatch} title={t.stopwatch} onClick={onStartStopwatch}>
            <Watch size={14} strokeWidth={2} aria-hidden="true" />
            <span>{stopwatch ? t.panel.newStopwatch : t.stopwatch}</span>
            {stopwatch && <span className="timer-split__sw-live">{clockText(shownMs(stopwatch, now), false)}</span>}
          </button>
          <button
            className={`timer-panel__icon-btn${sound ? " timer-panel__icon-btn--accent" : ""}`}
            type="button"
            aria-label={sound ? t.panel.soundOn : t.panel.soundOff}
            title={sound ? t.panel.soundOn : t.panel.soundOff}
            aria-pressed={sound}
            onClick={onToggleSound}
          >
            {sound ? <Volume2 size={14} strokeWidth={1.9} aria-hidden="true" /> : <VolumeX size={14} strokeWidth={1.9} aria-hidden="true" />}
          </button>
          <TimerLayoutMenu layout={layout} onLayout={onLayout} />
        </div>
      </div>

      <div className={`timer-split__stage${singleRinging ? " timer-split__stage--ringing" : ""}`}>
        {sorted.length === 0 ? (
          <div className="timer-split__empty">
            <div className="timer-split__dial">
              <svg className="timer-split__dial-svg" viewBox="0 0 112 112" aria-hidden="true">
                <circle className="timer-split__dial-track" cx="56" cy="56" r={RING_RADIUS} />
                <circle
                  className="timer-split__dial-arc"
                  cx="56"
                  cy="56"
                  r={RING_RADIUS}
                  strokeDasharray={RING_CIRCUMFERENCE}
                  style={{ "--timer-ring-offset": `${RING_CIRCUMFERENCE * (1 - previewFrac)}` } as CSSProperties}
                />
              </svg>
              <div className="timer-split__dial-center">
                <span className="timer-split__dial-time">{clockText(previewMs, true)}</span>
                <span className="timer-split__dial-sub">{parsed !== null ? t.panel.previewLabel : t.panel.quickSetLabel}</span>
              </div>
            </div>
            <div className="timer-split__empty-side">
              <p className="timer-panel__empty timer-split__empty-title">{parsed !== null ? t.panel.pressEnterStart : t.empty}</p>
              <span className="timer-split__hero-meta">{t.panel.etaAt(etaClockText(previewMs, now))}</span>
              {parsed === null && (
                <div className="timer-split__steps">
                  <button className="timer-split__step" type="button" onClick={() => stepStandby(-1)}>{t.panel.stepMinusOne}</button>
                  <button className="timer-split__step" type="button" onClick={() => stepStandby(1)}>{t.panel.stepPlusOne}</button>
                  <button className="timer-split__step" type="button" onClick={() => stepStandby(5)}>{t.panel.stepPlusFive}</button>
                </div>
              )}
              <button
                className="timer-panel__pill timer-panel__pill--accent"
                type="button"
                onClick={() => {
                  onStartCountdown(previewMs);
                  if (parsed !== null) onTextChange("");
                }}
              >
                <Play size={12} strokeWidth={2.4} aria-hidden="true" />
                {t.panel.startWithLength(clockText(previewMs, true))}
              </button>
            </div>
          </div>
        ) : sorted.length === 1 ? (
          <SplitHero timer={sorted[0]} now={now} onToggle={onToggle} onExtend={onExtend} onCancel={onCancel} />
        ) : (
          <>
            <div className="timer-split__list-head">
              <span>{t.panel.activeCount(sorted.length, MAX_TIMERS)}</span>
              <span>{hasDue ? t.panel.hasDue : t.panel.sortedHint}</span>
            </div>
            <ul className="timer-panel__list">
              {sorted.map((timer) => (
                <TimerCompactRow key={timer.id} timer={timer} now={now} onToggle={onToggle} onExtend={onExtend} onCancel={onCancel} />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
