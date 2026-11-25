import { useEffect, useState, type CSSProperties } from "react";
import { BellRing, ChevronDown, ChevronUp, Flag, Pause, Play, Plus, RotateCcw, Timer as TimerIcon, X } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { etaClockText, progressOf, sortPanelTimers } from "../timerLayout.ts";
import { clockText, elapsedOf, EXTEND_MS, isFinished, shownMs, type Timer } from "../timers.ts";
import { TimerInputForm, TimerLayoutMenu, useOwnerName } from "./TimerChrome";
import type { TimerLayoutProps } from "./types.ts";
import "./DialLayout.css";

const DIAL_PRESETS = [1, 3, 5, 10, 15, 25, 45] as const;
const ONE_MINUTE_MS = 60_000;

function formatTenths(ms: number): string {
  return `${clockText(ms, false)}.${Math.floor((Math.max(0, ms) % 1000) / 100)}`;
}

function DialCountdownStage({
  countdowns,
  selectedId,
  now,
  onSelect,
  onToggle,
  onExtend,
  onCancel,
}: {
  countdowns: readonly Timer[];
  selectedId: string | null;
  now: number;
  onSelect: (id: string) => void;
  onToggle: (timer: Timer) => void;
  onExtend: (timer: Timer, addMs: number) => void;
  onCancel: (id: string) => void;
}) {
  const t = useTranslation().timer;
  const active = countdowns.find((item) => item.id === selectedId) ?? countdowns[0];
  const ownerName = useOwnerName(active.owner);
  const done = isFinished(active, now);
  const running = active.runningSince !== null;
  const ms = shownMs(active, now);
  const pct = done ? 100 : (1 - progressOf(active, now)) * 100;
  const Icon = done ? BellRing : TimerIcon;

  return (
    <div className="timer-dial__main">
      <div className={`timer-dial__stage timer-panel__row${done ? " timer-panel__row--done" : ""}${running || done ? "" : " timer-panel__row--paused"}`}>
        <div className="timer-dial__tag">
          <Icon size={14} strokeWidth={2} aria-hidden="true" />
          <span>{done ? t.ended : `${t.countdown} · ${clockText(active.durationMs, true)}`}</span>
          {ownerName && <span className="timer-panel__source timer-split__source-pill">{t.from(ownerName)}</span>}
          {!done && running && <span className="timer-dial__eta">· {t.panel.etaShort(etaClockText(ms, now))}</span>}
        </div>
        <div className="timer-dial__big timer-panel__time">{clockText(ms, true)}</div>
        <div className="timer-dial__track" aria-hidden="true">
          <div className="timer-dial__fill" style={{ "--timer-progress": `${pct.toFixed(1)}%` } as CSSProperties} />
        </div>
        <div className="timer-dial__acts">
          {done ? (
            <>
              <button className="timer-panel__pill timer-panel__pill--accent" type="button" aria-label={t.extend} onClick={() => onExtend(active, EXTEND_MS)}>
                <Plus size={12} strokeWidth={2.4} aria-hidden="true" />
                {t.extend}
              </button>
              <button className="timer-panel__pill" type="button" aria-label={t.dismiss} onClick={() => onCancel(active.id)}>
                {t.dismiss}
              </button>
            </>
          ) : (
            <>
              <button className="timer-panel__pill timer-panel__pill--soft" type="button" onClick={() => onExtend(active, ONE_MINUTE_MS)}>
                {t.panel.addOneMin}
              </button>
              <button className="timer-panel__pill timer-panel__pill--accent" type="button" aria-label={running ? t.pause : t.resume} onClick={() => onToggle(active)}>
                {running ? <Pause size={12} strokeWidth={2.4} aria-hidden="true" /> : <Play size={12} strokeWidth={2.4} aria-hidden="true" />}
                {running ? t.pause : t.resume}
              </button>
              <button className="timer-panel__pill timer-panel__pill--soft" type="button" onClick={() => onExtend(active, EXTEND_MS)}>
                {t.panel.addFiveMin}
              </button>
              <button className="timer-panel__icon-btn" type="button" aria-label={t.cancel} title={t.cancel} onClick={() => onCancel(active.id)}>
                <X size={13} strokeWidth={2.2} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>

      {countdowns.length > 1 && (
        <div className="timer-dial__rail">
          <span className="timer-dial__rail-head">{t.panel.allCountdowns(countdowns.length)}</span>
          <div className="timer-dial__rail-list">
            {countdowns.map((item) => {
              const itemDone = isFinished(item, now);
              return (
                <button
                  key={item.id}
                  className={`timer-dial__qitem${item.id === active.id ? " timer-dial__qitem--active" : ""}${itemDone ? " timer-panel__row--done" : ""}`}
                  type="button"
                  onClick={() => onSelect(item.id)}
                >
                  {itemDone ? <BellRing size={13} strokeWidth={2} aria-hidden="true" /> : <TimerIcon size={13} strokeWidth={2} aria-hidden="true" />}
                  <span className="timer-dial__qlabel">{itemDone ? t.ended : clockText(item.durationMs, true)}</span>
                  <span className="timer-dial__qtime">{clockText(shownMs(item, now), true)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function DialLayout(props: TimerLayoutProps) {
  const { timers, now, text, problem, layout, inputRef, onTextChange, onSubmit, onStartCountdown, onStartStopwatch, onToggle, onExtend, onCancel, onLayout, onFastTickChange } = props;
  const t = useTranslation().timer;
  const [tab, setTab] = useState<"countdown" | "stopwatch">("countdown");
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(15);
  const [seconds, setSeconds] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [laps, setLaps] = useState<{ watchId: string; marks: number[] }>({ watchId: "", marks: [] });

  const countdowns = sortPanelTimers(timers.filter((item) => item.kind === "countdown"), now);
  const stopwatch = [...timers].reverse().find((item) => item.kind === "stopwatch") ?? null;
  const watchRunning = stopwatch?.runningSince != null;
  const watchMs = stopwatch ? elapsedOf(stopwatch, Math.max(now, stopwatch.runningSince ?? 0)) : 0;
  const watchLaps = stopwatch && laps.watchId === stopwatch.id ? laps.marks : [];

  useEffect(() => {
    onFastTickChange?.(tab === "stopwatch" && watchRunning);
    return () => onFastTickChange?.(false);
  }, [tab, watchRunning, onFastTickChange]);

  const step = (unit: "h" | "m" | "s", delta: number) => {
    if (unit === "h") setHours((current) => (current + delta + 24) % 24);
    else if (unit === "m") setMinutes((current) => (current + delta + 60) % 60);
    else setSeconds((current) => (current + delta + 60) % 60);
  };

  const startPicked = () => {
    const durationMs = (hours * 3600 + minutes * 60 + seconds) * 1000;
    if (durationMs >= 1000) onStartCountdown(durationMs);
  };

  const toggleStopwatch = () => {
    if (!stopwatch) onStartStopwatch();
    else onToggle(stopwatch);
  };

  const recordLap = () => {
    if (!stopwatch) return;
    const mark = elapsedOf(stopwatch, Date.now());
    setLaps((current) => ({
      watchId: stopwatch.id,
      marks: current.watchId === stopwatch.id ? [...current.marks, mark] : [mark],
    }));
  };

  const resetStopwatch = () => {
    if (!stopwatch) return;
    setLaps({ watchId: "", marks: [] });
    onCancel(stopwatch.id);
  };

  const pad = (value: number) => String(value).padStart(2, "0");

  return (
    <div className="timer-dial">
      <div className="timer-dial__bar">
        <div className="timer-dial__tabs" role="tablist" aria-label={t.countdown}>
          <button className={`timer-dial__tab${tab === "countdown" ? " timer-dial__tab--on" : ""}`} type="button" role="tab" aria-selected={tab === "countdown"} onClick={() => setTab("countdown")}>
            {t.countdown}
            {countdowns.length > 0 && <span className="timer-dial__dot" aria-hidden="true" />}
          </button>
          <button className={`timer-dial__tab${tab === "stopwatch" ? " timer-dial__tab--on" : ""}`} type="button" role="tab" aria-selected={tab === "stopwatch"} onClick={() => setTab("stopwatch")}>
            {t.stopwatchLabel}
            {stopwatch && <span className="timer-dial__dot" aria-hidden="true" />}
          </button>
        </div>
        <div className="timer-dial__bar-right">
          <TimerInputForm text={text} problem={problem} inputRef={inputRef} compact onTextChange={onTextChange} onSubmit={(event) => { setTab("countdown"); onSubmit(event); }} />
          <TimerLayoutMenu layout={layout} onLayout={onLayout} />
        </div>
      </div>

      {problem && <p className="timer-panel__problem" role="alert">{problem}</p>}

      {tab === "stopwatch" ? (
        <div className="timer-dial__main">
          <div className={`timer-dial__stage${stopwatch ? " timer-panel__row" : ""}`}>
            <div className="timer-dial__big timer-panel__time">
              {clockText(watchMs, false)}
              <small className="timer-dial__tenths">.{Math.floor((Math.max(0, watchMs) % 1000) / 100)}</small>
            </div>
            <div className="timer-dial__acts">
              <button
                className="timer-panel__pill timer-panel__pill--accent"
                type="button"
                aria-label={watchRunning ? t.pause : stopwatch ? t.resume : t.stopwatch}
                onClick={toggleStopwatch}
              >
                {watchRunning ? <Pause size={12} strokeWidth={2.4} aria-hidden="true" /> : <Play size={12} strokeWidth={2.4} aria-hidden="true" />}
                {watchRunning ? t.pause : stopwatch ? t.resume : t.stopwatch}
              </button>
              <button className="timer-panel__pill" type="button" disabled={!stopwatch} onClick={recordLap}>
                <Flag size={12} strokeWidth={2.2} aria-hidden="true" />
                {t.panel.lap}
              </button>
              {stopwatch && (
                <button className="timer-panel__icon-btn" type="button" aria-label={t.panel.resetStopwatch} title={t.panel.resetStopwatch} onClick={resetStopwatch}>
                  <RotateCcw size={13} strokeWidth={2.2} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
          <div className="timer-dial__laps">
            <div className="timer-dial__laps-head">
              <span>{t.panel.lapsTitle}</span>
              <span>{t.panel.lapsCount(watchLaps.length)}</span>
            </div>
            <div className="timer-dial__laps-body">
              {watchLaps.length === 0 ? (
                <p className="timer-dial__laps-empty">{t.panel.lapsEmpty}</p>
              ) : (
                [...watchLaps].reverse().map((mark, reverseIndex) => {
                  const index = watchLaps.length - reverseIndex;
                  const prev = index > 1 ? watchLaps[index - 2] : 0;
                  return (
                    <div key={index} className="timer-dial__lap-row">
                      <span>#{index}</span>
                      <span className="timer-dial__lap-diff">+{formatTenths(mark - prev)}</span>
                      <strong>{formatTenths(mark)}</strong>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : countdowns.length === 0 ? (
        <div className="timer-dial__stage">
          <div className="timer-dial__picker">
            {([
              ["h", hours, t.panel.hoursUnit, 1],
              ["m", minutes, t.panel.minutesUnit, 1],
              ["s", seconds, t.panel.secondsUnit, 10],
            ] as const).map(([unit, value, unitLabel, stepBy], index) => (
              <div key={unit} className="timer-dial__unit-wrap">
                {index > 0 && <span className="timer-dial__colon" aria-hidden="true">:</span>}
                <div className="timer-dial__unit">
                  <button className="timer-dial__nudge" type="button" aria-label={t.panel.increaseUnit(unitLabel)} onClick={() => step(unit, stepBy)}>
                    <ChevronUp size={13} strokeWidth={2.2} aria-hidden="true" />
                  </button>
                  <span className="timer-dial__num">{pad(value)}</span>
                  <button className="timer-dial__nudge" type="button" aria-label={t.panel.decreaseUnit(unitLabel)} onClick={() => step(unit, -stepBy)}>
                    <ChevronDown size={13} strokeWidth={2.2} aria-hidden="true" />
                  </button>
                  <span className="timer-dial__lbl">{unitLabel}</span>
                </div>
              </div>
            ))}
            <button className="timer-panel__pill timer-panel__pill--accent timer-dial__go" type="button" onClick={startPicked}>
              <Play size={12} strokeWidth={2.4} aria-hidden="true" />
              {t.start}
            </button>
          </div>
          <div className="timer-dial__chips">
            {DIAL_PRESETS.map((min) => (
              <button key={min} className="timer-dial__chip" type="button" onClick={() => onStartCountdown(min * ONE_MINUTE_MS)}>
                {t.panel.minutesFull(min)}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <DialCountdownStage
          countdowns={countdowns}
          selectedId={selectedId}
          now={now}
          onSelect={setSelectedId}
          onToggle={onToggle}
          onExtend={onExtend}
          onCancel={onCancel}
        />
      )}
    </div>
  );
}
