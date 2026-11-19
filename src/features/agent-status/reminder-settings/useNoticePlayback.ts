import { useCallback, useEffect, useRef, useState } from "react";
import type { IslandSettings } from "../../../lib/settings/types";
import { MOTION_MEDIUM_MS } from "../../../lib/theme/motionTokens";
import { AFTER_HOVER_MS } from "../noticeDwell";
import {
  PLAY_COLLAPSED_MS,
  PLAY_ENDED_MS,
  PLAY_REMIND_MS,
  playSeconds,
  previewShow,
  previewStay,
  type PreviewEvent,
  type PreviewStay,
} from "./previewEvents";

const HIDDEN_MS = 2600;
const REST_MS = 900;

export type PlayPhase = "idle" | "collapsed" | "shown" | "leaving";

export type PlayStep = "collapsed" | "hidden" | "handled" | "remindSoon" | "reminded" | "looked" | "seconds" | "leaving" | "ended";

export type PlayCountdown = { ms: number; total: number; held: boolean; turn: number };

export type PlayState = { phase: PlayPhase; step: PlayStep | null; pops: number; countdown: PlayCountdown | null };

type Run = {
  timers: number[];
  stay: PreviewStay;
  hold: boolean;
  shown: boolean;
  leaving: boolean;
  seen: boolean;
  held: boolean;
  after: number;
  countdown: number;
  endsAt: number;
  left: number;
  total: number;
  turn: number;
};

const IDLE: PlayState = { phase: "idle", step: null, pops: 0, countdown: null };

function halt(run: Run | null) {
  if (!run) return;
  run.timers.forEach((timer) => window.clearTimeout(timer));
  window.clearTimeout(run.after);
  window.clearTimeout(run.countdown);
  run.timers = [];
}

export function useNoticePlayback({ event, settings, onSound }: { event: PreviewEvent; settings: IslandSettings; onSound: () => void }) {
  const [state, setState] = useState<PlayState>(IDLE);
  const runRef = useRef<Run | null>(null);

  const stop = useCallback(() => {
    halt(runRef.current);
    runRef.current = null;
    setState(IDLE);
  }, []);

  useEffect(() => () => halt(runRef.current), []);

  const later = (run: Run, ms: number, step: () => void) => {
    const timer = window.setTimeout(() => {
      if (runRef.current === run) step();
    }, ms);
    run.timers.push(timer);
    return timer;
  };

  const leave = (run: Run, step: PlayStep) => {
    if (run.leaving) return;
    halt(run);
    run.leaving = true;
    setState((current) => ({ ...current, phase: "leaving", step, countdown: null }));
    later(run, MOTION_MEDIUM_MS, () => {
      setState((current) => ({ ...current, phase: "collapsed" }));
      later(run, REST_MS, stop);
    });
  };

  const count = (run: Run, ms: number) => {
    run.left = ms;
    run.endsAt = performance.now() + ms;
    run.turn += 1;
    run.countdown = later(run, ms, () => leave(run, "leaving"));
    setState((current) => ({ ...current, countdown: { ms, total: run.total, held: false, turn: run.turn } }));
  };

  const start = () => {
    halt(runRef.current);
    const stay = previewStay(event, settings);
    const show = previewShow(event, settings);
    const remind = (event === "approval" || event === "question") && settings.agentRemindSeconds > 0;
    const total = typeof stay === "number" ? playSeconds(stay) * 1000 : 0;
    const run: Run = { timers: [], stay, hold: settings.agentNoticeHoverHold, shown: false, leaving: false, seen: false, held: false, after: 0, countdown: 0, endsAt: 0, left: 0, total, turn: 0 };
    runRef.current = run;
    setState({ phase: "collapsed", step: "collapsed", pops: 0, countdown: null });
    later(run, PLAY_COLLAPSED_MS, () => {
      onSound();
      if (show !== "card") {
        setState({ phase: "collapsed", step: "hidden", pops: 0, countdown: null });
        later(run, HIDDEN_MS, stop);
        return;
      }
      run.shown = true;
      if (stay === "handled") {
        setState({ phase: "shown", step: remind ? "remindSoon" : "handled", pops: 1, countdown: null });
        if (remind) {
          later(run, PLAY_REMIND_MS, () => {
            onSound();
            setState((current) => ({ ...current, step: "reminded", pops: current.pops + 1 }));
          });
        }
        later(run, PLAY_ENDED_MS, () => leave(run, "ended"));
        return;
      }
      if (stay === "looked") {
        setState({ phase: "shown", step: "looked", pops: 1, countdown: null });
        later(run, PLAY_ENDED_MS, () => leave(run, "ended"));
        return;
      }
      setState({ phase: "shown", step: "seconds", pops: 1, countdown: null });
      count(run, total);
    });
  };

  const decide = () => {
    const run = runRef.current;
    if (run?.shown && run.stay === "handled") leave(run, "leaving");
  };

  const hover = (inside: boolean) => {
    const run = runRef.current;
    if (!run?.shown || run.leaving) return;
    if (run.stay === "looked") {
      window.clearTimeout(run.after);
      if (inside) run.seen = true;
      else if (run.seen) run.after = later(run, AFTER_HOVER_MS, () => leave(run, "leaving"));
      return;
    }
    if (typeof run.stay !== "number" || !run.hold) return;
    if (inside === run.held) return;
    run.held = inside;
    window.clearTimeout(run.countdown);
    if (!inside) {
      count(run, Math.max(run.left, AFTER_HOVER_MS));
      return;
    }
    run.left = Math.max(0, run.endsAt - performance.now());
    setState((current) => ({ ...current, countdown: { ms: run.left, total: run.total, held: true, turn: run.turn } }));
  };

  return { ...state, playing: state.phase !== "idle", start, stop, decide, hover };
}

export type NoticePlayback = ReturnType<typeof useNoticePlayback>;
