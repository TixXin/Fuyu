import { useCallback, useEffect, useRef, useState, type ComponentType, type FormEvent } from "react";
import { useTranslation } from "../../i18n";
import { visibilityInterval } from "../../lib/useVisibilityInterval";
import { DialLayout } from "./layouts/DialLayout";
import { GridLayout } from "./layouts/GridLayout";
import { HubLayout } from "./layouts/HubLayout";
import { SplitLayout } from "./layouts/SplitLayout";
import type { TimerLayoutProps } from "./layouts/types.ts";
import { loadRecentMinutes, saveRecentMinutes } from "./storage.ts";
import { cancelTimer, extendTimer, pauseTimer, resumeTimer, startCountdown, startStopwatch, useTimers } from "./store";
import { extendedRunningByMs, pushRecentMinutes, type TimerLayout } from "./timerLayout.ts";
import { MAX_TIMERS, parseDuration, type Timer } from "./timers.ts";
import { useTimerConfig } from "./useTimerConfig";
import "../../components/list/IslandList.css";
import "./TimerPanel.css";

const TICK_MS = 250;
const FAST_TICK_MS = 100;

const LAYOUT_COMPONENTS: Record<TimerLayout, ComponentType<TimerLayoutProps>> = {
  split: SplitLayout,
  dial: DialLayout,
  grid: GridLayout,
  hub: HubLayout,
};

function useNow(running: boolean, fast: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (!running) return;
    return visibilityInterval(() => setNow(Date.now()), fast ? FAST_TICK_MS : TICK_MS);
  }, [running, fast]);
  return now;
}

export function TimerPanel({ isOpen }: { isOpen: boolean }) {
  const t = useTranslation().timer;
  const { timers, openRequest } = useTimers();
  const [config, updateConfig] = useTimerConfig();
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [recents, setRecents] = useState<number[]>(loadRecentMinutes);
  const [fastTick, setFastTick] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const now = useNow(isOpen && timers.some((timer) => timer.runningSince !== null), fastTick);

  useEffect(() => {
    if (isOpen && openRequest?.focus) inputRef.current?.focus();
  }, [isOpen, openRequest]);

  const recordRecent = useCallback((durationMs: number) => {
    setRecents((current) => {
      const next = pushRecentMinutes(current, durationMs);
      saveRecentMinutes(next);
      return next;
    });
  }, []);

  const handleStartCountdown = useCallback((durationMs: number, clearInput = false) => {
    if (timers.length >= MAX_TIMERS) {
      setProblem(t.full);
      return;
    }
    void startCountdown(durationMs).then((result) => {
      if (result === "ok") {
        if (clearInput) setText("");
        setProblem(null);
        recordRecent(durationMs);
      } else {
        setProblem(result === "limit" ? t.full : t.unavailable);
      }
    });
  }, [timers.length, t.full, t.unavailable, recordRecent]);

  const handleSubmit = useCallback((event: FormEvent) => {
    event.preventDefault();
    const length = parseDuration(text);
    if (length === null) {
      setProblem(t.invalid);
      return;
    }
    handleStartCountdown(length, true);
  }, [text, t.invalid, handleStartCountdown]);

  const handleStartStopwatch = useCallback(() => {
    if (timers.length >= MAX_TIMERS) {
      setProblem(t.full);
      return;
    }
    void startStopwatch().then((result) => {
      setProblem(result === "ok" ? null : result === "limit" ? t.full : t.unavailable);
    });
  }, [timers.length, t.full, t.unavailable]);

  const handleToggle = useCallback((timer: Timer) => {
    if (timer.runningSince !== null) pauseTimer(timer.id);
    else resumeTimer(timer.id);
  }, []);

  const handleExtend = useCallback((timer: Timer, addMs: number) => {
    const byMs = extendedRunningByMs(timer, Date.now(), addMs);
    extendTimer(timer.id, byMs);
  }, []);

  const handleTextChange = useCallback((value: string) => {
    setText(value);
    setProblem(null);
  }, []);

  const handleLayout = useCallback((layout: TimerLayout) => {
    updateConfig("layout", layout);
  }, [updateConfig]);

  const handleToggleSound = useCallback(() => {
    updateConfig("sound", !config.sound);
  }, [config.sound, updateConfig]);

  const Layout = LAYOUT_COMPONENTS[config.layout];

  return (
    <section className="island-list-page timer-panel" data-layout={config.layout} aria-label={t.countdown}>
      <Layout
        timers={timers}
        now={now}
        text={text}
        problem={problem}
        layout={config.layout}
        sound={config.sound}
        recents={recents}
        inputRef={inputRef}
        onTextChange={handleTextChange}
        onSubmit={handleSubmit}
        onStartCountdown={(durationMs) => handleStartCountdown(durationMs)}
        onStartStopwatch={handleStartStopwatch}
        onToggle={handleToggle}
        onExtend={handleExtend}
        onCancel={cancelTimer}
        onLayout={handleLayout}
        onToggleSound={handleToggleSound}
        onFastTickChange={setFastTick}
      />
    </section>
  );
}
