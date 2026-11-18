import type { IslandSettings } from "../../lib/settings/types";

export const EXTERNAL_RESIZE_BURST_MS = 160;
export const EXTERNAL_RESIZE_SETTLE_MS = 180;

const GEOMETRY_KEYS = [
  "collapsedScale",
  "expandedScale",
  "collapsedWidthExtra",
  "panelWidth",
  "maxPanelHeight",
  "islandCornerRadius",
  "topFilletRadius",
  "marginY",
] as const satisfies readonly (keyof IslandSettings)[];

type GeometryKey = (typeof GEOMETRY_KEYS)[number];
type GeometrySnapshot = Partial<Record<GeometryKey, number>>;

function pickGeometry(source: Record<string, unknown>): GeometrySnapshot {
  const out: GeometrySnapshot = {};
  for (const key of GEOMETRY_KEYS) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      out[key] = value;
    }
  }
  return out;
}

function sameGeometry(left: GeometrySnapshot, right: GeometrySnapshot): boolean {
  for (const key of GEOMETRY_KEYS) {
    if (left[key] !== right[key]) return false;
  }
  return true;
}

export type SingleFlightQueueOptions = {
  requestFrame?: (callback: () => void) => number;
  cancelFrame?: (id: number) => void;
};

export function createSingleFlightFrameQueue<T>(
  run: (item: T) => Promise<void>,
  options: SingleFlightQueueOptions = {},
) {
  const requestFrame =
    options.requestFrame ?? ((callback: () => void) => window.requestAnimationFrame(callback));
  const cancelFrame =
    options.cancelFrame ?? ((id: number) => window.cancelAnimationFrame(id));

  let frame: number | null = null;
  let inFlight = false;
  let disposed = false;
  let hasPending = false;
  let pending: T | undefined;
  let waiters: Array<() => void> = [];

  const flush = () => {
    if (inFlight || !hasPending) return;
    const item = pending as T;
    hasPending = false;
    pending = undefined;
    const batchWaiters = waiters;
    waiters = [];
    inFlight = true;

    void run(item).finally(() => {
      inFlight = false;
      for (const resolve of batchWaiters) resolve();
      if (!hasPending) return;
      if (disposed) {
        flush();
        return;
      }
      if (frame === null) {
        frame = requestFrame(() => {
          frame = null;
          flush();
        });
      }
    });
  };

  const schedule = (item: T): Promise<void> => {
    pending = item;
    hasPending = true;
    const promise = new Promise<void>((resolve) => {
      waiters.push(resolve);
    });
    if (disposed) {
      flush();
      return promise;
    }
    if (frame === null && !inFlight) {
      frame = requestFrame(() => {
        frame = null;
        flush();
      });
    }
    return promise;
  };

  const dispose = () => {
    disposed = true;
    if (frame !== null) {
      cancelFrame(frame);
      frame = null;
    }
    if (hasPending && !inFlight) {
      flush();
    }
  };

  return { schedule, dispose };
}

export type ExternalResizeTrackerOptions = {
  setResizing: (active: boolean) => void;
  setTimer?: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (id: ReturnType<typeof setTimeout>) => void;
  burstWindowMs?: number;
  settleDelayMs?: number;
};

export function createExternalResizeTracker(
  initial: Partial<IslandSettings>,
  options: ExternalResizeTrackerOptions,
) {
  const setTimer = options.setTimer ?? ((callback, ms) => globalThis.setTimeout(callback, ms));
  const clearTimer = options.clearTimer ?? ((id) => globalThis.clearTimeout(id));
  const burstWindowMs = options.burstWindowMs ?? EXTERNAL_RESIZE_BURST_MS;
  const settleDelayMs = options.settleDelayMs ?? EXTERNAL_RESIZE_SETTLE_MS;

  let lastGeometry = pickGeometry(initial as Record<string, unknown>);
  let lastChangeAt: number | null = null;
  let active = false;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;

  const stopTimer = () => {
    if (settleTimer !== null) {
      clearTimer(settleTimer);
      settleTimer = null;
    }
  };

  const syncLocal = (settings: Partial<IslandSettings>) => {
    lastGeometry = pickGeometry(settings as Record<string, unknown>);
  };

  const onStorageValue = (raw: string | null | undefined, now: number): boolean => {
    if (typeof raw !== "string" || !raw) return active;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return active;
    }
    if (typeof parsed !== "object" || parsed === null) return active;
    const nextGeometry = pickGeometry(parsed as Record<string, unknown>);
    if (sameGeometry(lastGeometry, nextGeometry)) return active;
    lastGeometry = nextGeometry;

    const isBurst = lastChangeAt !== null && now - lastChangeAt <= burstWindowMs;
    lastChangeAt = now;
    if (isBurst && !active) {
      active = true;
      options.setResizing(true);
    }
    if (active) {
      stopTimer();
      settleTimer = setTimer(() => {
        settleTimer = null;
        active = false;
        lastChangeAt = null;
        options.setResizing(false);
      }, settleDelayMs);
    }
    return active;
  };

  const dispose = () => {
    stopTimer();
    lastChangeAt = null;
    if (active) {
      active = false;
      options.setResizing(false);
    }
  };

  return { syncLocal, onStorageValue, dispose, isActive: () => active };
}
