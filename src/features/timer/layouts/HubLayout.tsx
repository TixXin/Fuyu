import type { CSSProperties } from "react";
import { BellRing, Pause, Play, Plus, RotateCcw, Timer as TimerIcon, Watch, X } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { resetBreakProgress, useBreakProgress } from "../breakProgressStore";
import { intervalMs, type BreakReminder } from "../breakReminders.ts";
import { REMINDER_ICONS } from "../reminderIcons";
import { etaClockText, HUB_PRESETS, progressOf, sortPanelTimers } from "../timerLayout.ts";
import { clockText, EXTEND_MS, isFinished, shownMs, type Timer } from "../timers.ts";
import { useBreakReminderSettings } from "../useBreakReminderSettings";
import { TimerCompactRow, TimerInputForm, TimerLayoutMenu, useOwnerName } from "./TimerChrome";
import type { TimerLayoutProps } from "./types.ts";
import "./HubLayout.css";

const ONE_MINUTE_MS = 60_000;

function HubSingleCard({
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
  const pct = timer.kind === "countdown" ? (done ? 100 : (1 - progressOf(timer, now)) * 100) : 100;
  const label = timer.kind === "countdown" ? `${t.countdown} · ${clockText(timer.durationMs, true)}` : t.stopwatchLabel;

  return (
    <div className={`timer-hub__hero timer-panel__row${done ? " timer-panel__row--done" : ""}${running || done ? "" : " timer-panel__row--paused"}`}>
      <div className="timer-hub__hero-top">
        <div className="timer-hub__hero-meta">
          <span className="timer-hub__hero-tag">
            <Icon size={14} strokeWidth={2} aria-hidden="true" />
            <span>{done ? t.ended : label}</span>
            {ownerName && <span className="timer-panel__source">· {ownerName}</span>}
          </span>
          <span className="timer-split__hero-meta">
            {done ? t.panel.ringingHint : timer.kind === "countdown" ? (running ? t.panel.etaAt(etaClockText(ms, now)) : t.panel.pausedLabel) : (running ? t.panel.stopwatchRunning : t.panel.stopwatchPaused)}
          </span>
        </div>
        <span className="timer-hub__hero-clock timer-panel__time">{clockText(ms, timer.kind === "countdown")}</span>
      </div>
      <div className="timer-hub__track" aria-hidden="true">
        <div className="timer-hub__fill" style={{ "--timer-progress": `${pct.toFixed(1)}%` } as CSSProperties} />
      </div>
      <div className="timer-hub__hero-acts">
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
            <button className="timer-panel__pill timer-panel__pill--accent" type="button" aria-label={running ? t.pause : t.resume} onClick={() => onToggle(timer)}>
              {running ? <Pause size={12} strokeWidth={2.4} aria-hidden="true" /> : <Play size={12} strokeWidth={2.4} aria-hidden="true" />}
              {running ? t.pause : t.resume}
            </button>
            {timer.kind === "countdown" && (
              <button className="timer-panel__pill timer-panel__pill--soft" type="button" onClick={() => onExtend(timer, EXTEND_MS)}>
                {t.panel.addFiveMin}
              </button>
            )}
            <button className="timer-panel__icon-btn timer-hub__cancel" type="button" aria-label={t.cancel} title={t.cancel} onClick={() => onCancel(timer.id)}>
              <X size={13} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function HubLayout(props: TimerLayoutProps) {
  const { timers, now, text, problem, layout, recents, inputRef, onTextChange, onSubmit, onStartCountdown, onStartStopwatch, onToggle, onExtend, onCancel, onLayout } = props;
  const t = useTranslation().timer;
  const [breaks, setBreaks] = useBreakReminderSettings();
  const progress = useBreakProgress();
  const sorted = sortPanelTimers(timers, now);
  const enabledBreaks = breaks.items.filter((item) => item.enabled);

  const breakName = (item: BreakReminder) =>
    item.name.trim() || (item.id === "sit" ? t.breaks.sitName : item.id === "eyes" ? t.breaks.eyesName : t.breaks.iconNames[item.icon]);

  return (
    <div className="timer-hub">
      <div className="timer-hub__left">
        <div className="timer-hub__top">
          <TimerInputForm text={text} problem={problem} inputRef={inputRef} onTextChange={onTextChange} onSubmit={onSubmit} />
          <button className="timer-panel__icon-btn timer-panel__icon-btn--accent" type="button" aria-label={t.stopwatch} title={t.stopwatch} onClick={onStartStopwatch}>
            <Watch size={14} strokeWidth={2} aria-hidden="true" />
          </button>
          <TimerLayoutMenu layout={layout} onLayout={onLayout} />
        </div>
        {problem && <p className="timer-panel__problem" role="alert">{problem}</p>}
        <div className="timer-hub__presets">
          {HUB_PRESETS.map((minutes) => (
            <button key={minutes} className="timer-hub__chip" type="button" aria-label={t.quickStart(minutes)} onClick={() => onStartCountdown(minutes * ONE_MINUTE_MS)}>
              {minutes === 60 ? t.panel.hourShort(1) : t.panel.minuteShort(minutes)}
            </button>
          ))}
        </div>
        <div className="timer-hub__body">
          {sorted.length === 0 ? (
            <div className="timer-hub__empty">
              <div className="timer-hub__empty-top">
                <div>
                  <strong className="timer-hub__empty-title">{t.panel.hubTitle}</strong>
                  <p className="timer-panel__empty timer-hub__empty-sub">{t.panel.hubSub}</p>
                </div>
                <button className="timer-panel__pill timer-panel__pill--accent" type="button" onClick={() => onStartCountdown(25 * ONE_MINUTE_MS)}>
                  <Play size={12} strokeWidth={2.4} aria-hidden="true" />
                  {t.panel.focusPreset}
                </button>
              </div>
              {recents.length > 0 && (
                <div className="timer-hub__recents">
                  <span>{t.panel.recentLabel}</span>
                  {recents.map((minutes) => (
                    <button key={minutes} className="timer-hub__chip" type="button" onClick={() => onStartCountdown(minutes * ONE_MINUTE_MS)}>
                      {t.panel.minutesFull(minutes)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : sorted.length === 1 ? (
            <HubSingleCard timer={sorted[0]} now={now} onToggle={onToggle} onExtend={onExtend} onCancel={onCancel} />
          ) : (
            <ul className="timer-panel__list">
              {sorted.map((timer) => (
                <TimerCompactRow key={timer.id} timer={timer} now={now} onToggle={onToggle} onExtend={onExtend} onCancel={onCancel} />
              ))}
            </ul>
          )}
        </div>
      </div>

      <aside className="timer-hub__right" aria-label={t.breaks.title}>
        <div className="timer-hub__rhead">
          <span>{t.breaks.title}</span>
          <button
            className={`timer-hub__switch${breaks.enabled ? " timer-hub__switch--on" : ""}`}
            type="button"
            role="switch"
            aria-checked={breaks.enabled}
            aria-label={t.breaks.toggle}
            onClick={() => setBreaks({ ...breaks, enabled: !breaks.enabled })}
          />
        </div>
        <div className={`timer-hub__breaks${breaks.enabled ? "" : " timer-hub__breaks--off"}`}>
          {enabledBreaks.length === 0 ? (
            <p className="timer-hub__rfoot">{t.panel.breakEmpty}</p>
          ) : (
            enabledBreaks.map((item) => {
              const Icon = REMINDER_ICONS[item.icon];
              const limit = intervalMs(item);
              const elapsed = Math.min(limit, progress[item.id] ?? 0);
              const remainingMin = Math.max(1, Math.ceil((limit - elapsed) / ONE_MINUTE_MS));
              const pct = limit > 0 ? Math.min(100, (elapsed / limit) * 100) : 0;
              return (
                <div key={item.id} className="timer-hub__bitem">
                  <div className="timer-hub__btop">
                    <Icon className="timer-hub__bicon" size={13} strokeWidth={2} aria-hidden="true" />
                    <strong className="timer-hub__bname">{breakName(item)}</strong>
                    <span className="timer-hub__brem">{t.panel.breakRemaining(remainingMin)}</span>
                    <button
                      className="timer-hub__breset"
                      type="button"
                      aria-label={t.panel.breakReset}
                      title={t.panel.breakReset}
                      disabled={!breaks.enabled}
                      onClick={() => resetBreakProgress(item.id)}
                    >
                      <RotateCcw size={11} strokeWidth={2.2} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="timer-hub__bbar" aria-hidden="true">
                    <span style={{ width: `${pct.toFixed(0)}%` }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
        <p className="timer-hub__rfoot">{breaks.enabled ? t.panel.breakFooterOn : t.panel.breakFooterOff}</p>
      </aside>
    </div>
  );
}
