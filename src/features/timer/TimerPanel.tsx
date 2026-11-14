import { useEffect, useRef, useState, type FormEvent } from "react";
import { BellRing, Pause, Play, Plus, Timer as TimerIcon, Watch, X } from "lucide-react";
import { useTranslation } from "../../i18n";
import { cancelTimer, extendTimer, pauseTimer, resumeTimer, startCountdown, startStopwatch, useTimers } from "./store";
import { clockText, isFinished, parseDuration, shownMs, type Timer } from "./timers";
import "../../components/list/IslandList.css";
import "./TimerPanel.css";

const TICK_MS = 250;

function useNow(running: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, [running]);
  return now;
}

export function TimerPanel({ isOpen }: { isOpen: boolean }) {
  const t = useTranslation().timer;
  const { timers, openRequest } = useTimers();
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const now = useNow(isOpen && timers.some((timer) => timer.runningSince !== null));

  useEffect(() => {
    if (isOpen && openRequest?.focus) input.current?.focus();
  }, [isOpen, openRequest]);

  const start = (event: FormEvent) => {
    event.preventDefault();
    const length = parseDuration(text);
    if (length === null) {
      setProblem(t.invalid);
      return;
    }
    if (!startCountdown(length)) {
      setProblem(t.full);
      return;
    }
    setText("");
    setProblem(null);
  };
  const stopwatch = () => setProblem(startStopwatch() ? null : t.full);

  return (
    <section className="island-list-page timer-panel" aria-label={t.countdown}>
      <form className="timer-panel__form" onSubmit={start}>
        <input
          ref={input}
          className="timer-panel__input"
          value={text}
          placeholder={t.placeholder}
          aria-label={t.start}
          aria-invalid={problem === t.invalid}
          onChange={(event) => {
            setText(event.target.value);
            setProblem(null);
          }}
        />
        <button className="timer-panel__button timer-panel__button--main" type="submit" aria-label={t.start} title={t.start}>
          <Play size={14} strokeWidth={2.2} aria-hidden="true" />
        </button>
        <button className="timer-panel__button" type="button" aria-label={t.stopwatch} title={t.stopwatch} onClick={stopwatch}>
          <Watch size={14} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </form>
      {problem && <p className="timer-panel__problem" role="alert">{problem}</p>}
      {timers.length === 0 ? (
        <p className="timer-panel__empty">{t.empty}</p>
      ) : (
        <ul className="timer-panel__list">
          {timers.map((timer) => <TimerRow key={timer.id} timer={timer} now={now} />)}
        </ul>
      )}
    </section>
  );
}

function TimerRow({ timer, now }: { timer: Timer; now: number }) {
  const t = useTranslation().timer;
  const done = isFinished(timer, now);
  const running = timer.runningSince !== null;
  const Icon = done ? BellRing : timer.kind === "countdown" ? TimerIcon : Watch;
  const label = timer.kind === "countdown" ? `${t.countdown} · ${clockText(timer.durationMs, true)}` : t.stopwatchLabel;
  return (
    <li className={`timer-panel__row${done ? " timer-panel__row--done" : ""}${running ? "" : " timer-panel__row--paused"}`}>
      <Icon className="timer-panel__icon" size={15} strokeWidth={2} aria-hidden="true" />
      <span className="timer-panel__label">{done ? t.ended : label}</span>
      <span className="timer-panel__time">{clockText(shownMs(timer, now), timer.kind === "countdown")}</span>
      <span className="timer-panel__actions">
        {done ? (
          <button className="timer-panel__button" type="button" aria-label={t.extend} title={t.extend} onClick={() => extendTimer(timer.id)}>
            <Plus size={13} strokeWidth={2.2} aria-hidden="true" />
          </button>
        ) : (
          <button
            className="timer-panel__button"
            type="button"
            aria-label={running ? t.pause : t.resume}
            title={running ? t.pause : t.resume}
            onClick={() => (running ? pauseTimer(timer.id) : resumeTimer(timer.id))}
          >
            {running ? <Pause size={13} strokeWidth={2.2} aria-hidden="true" /> : <Play size={13} strokeWidth={2.2} aria-hidden="true" />}
          </button>
        )}
        <button className="timer-panel__button" type="button" aria-label={done ? t.dismiss : t.cancel} title={done ? t.dismiss : t.cancel} onClick={() => cancelTimer(timer.id)}>
          <X size={13} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </span>
    </li>
  );
}
