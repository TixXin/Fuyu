import type { FormEvent, RefObject } from "react";
import type { TimerLayout } from "../timerLayout.ts";
import type { Timer } from "../timers.ts";

export type TimerLayoutProps = {
  timers: readonly Timer[];
  now: number;
  text: string;
  problem: string | null;
  layout: TimerLayout;
  sound: boolean;
  recents: readonly number[];
  inputRef: RefObject<HTMLInputElement | null>;
  onTextChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onStartCountdown: (durationMs: number) => void;
  onStartStopwatch: () => void;
  onToggle: (timer: Timer) => void;
  onExtend: (timer: Timer, addMs: number) => void;
  onCancel: (id: string) => void;
  onLayout: (layout: TimerLayout) => void;
  onToggleSound: () => void;
  onFastTickChange?: (fast: boolean) => void;
};
