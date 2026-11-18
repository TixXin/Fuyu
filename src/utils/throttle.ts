export type ThrottleClock<Timer = ReturnType<typeof setTimeout>> = {
  now?: () => number;
  schedule?: (callback: () => void, delayMs: number) => Timer;
  clear?: (timer: Timer) => void;
};

export type Throttled<Args extends unknown[]> = ((...args: Args) => void) & {
  flush: () => void;
  cancel: () => void;
};

export function throttle<Args extends unknown[], Timer = ReturnType<typeof setTimeout>>(
  fn: (...args: Args) => void,
  intervalMs: number,
  clock: ThrottleClock<Timer> = {},
): Throttled<Args> {
  const now = clock.now ?? Date.now;
  const schedule = clock.schedule ?? ((cb, ms) => setTimeout(cb, ms) as unknown as Timer);
  const clear = clock.clear ?? ((timer) => clearTimeout(timer as unknown as ReturnType<typeof setTimeout>));

  let lastRunAt: number | null = null;
  let timer: Timer | null = null;
  let pending: { args: Args } | null = null;

  const invokePending = () => {
    timer = null;
    if (!pending) return;
    const { args } = pending;
    pending = null;
    lastRunAt = now();
    fn(...args);
  };

  const cancel = () => {
    if (timer !== null) {
      clear(timer);
      timer = null;
    }
    pending = null;
  };

  const flush = () => {
    if (!pending) return;
    if (timer !== null) {
      clear(timer);
      timer = null;
    }
    invokePending();
  };

  const wrapped = ((...args: Args) => {
    if (intervalMs <= 0) {
      cancel();
      lastRunAt = now();
      fn(...args);
      return;
    }
    const current = now();
    const elapsed = lastRunAt === null ? intervalMs : current - lastRunAt;
    if (elapsed >= intervalMs) {
      cancel();
      lastRunAt = current;
      fn(...args);
      return;
    }
    pending = { args };
    if (timer === null) {
      timer = schedule(invokePending, Math.max(0, intervalMs - elapsed));
    }
  }) as Throttled<Args>;

  wrapped.flush = flush;
  wrapped.cancel = cancel;
  return wrapped;
}
