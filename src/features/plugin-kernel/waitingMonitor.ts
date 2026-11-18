export const WAITING_NOTICE_DELAY_MS = 10_000;

export type WaitingPluginInput = {
  id: string;
  kind?: string;
  state: string;
  waitingFor?: string[];
};

export type WaitingOverdueInfo = {
  id: string;
  waitingFor: string[];
};

export function createWaitingMonitor({
  delayMs = WAITING_NOTICE_DELAY_MS,
  onOverdue,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}: {
  delayMs?: number;
  onOverdue: (info: WaitingOverdueInfo) => void;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}) {
  const timers = new Map<string, { handle: unknown; notified: boolean; waitingFor: string[] }>();

  const update = (plugins: readonly WaitingPluginInput[]) => {
    const seenWaiting = new Set<string>();
    for (const plugin of plugins) {
      const isBuiltin = plugin.kind === "builtin" || plugin.kind === "essential" || plugin.kind === undefined;
      const waitingList = Array.isArray(plugin.waitingFor) ? plugin.waitingFor.filter((s) => typeof s === "string") : [];
      if (isBuiltin && plugin.state === "waiting" && waitingList.length > 0) {
        seenWaiting.add(plugin.id);
        const existing = timers.get(plugin.id);
        if (existing) {
          existing.waitingFor = waitingList;
          continue;
        }
        const record = { handle: null as unknown, notified: false, waitingFor: waitingList };
        record.handle = setTimer(() => {
          const current = timers.get(plugin.id);
          if (!current || current.notified) return;
          current.notified = true;
          onOverdue({ id: plugin.id, waitingFor: [...current.waitingFor] });
        }, delayMs);
        timers.set(plugin.id, record);
      }
    }
    for (const [id, record] of [...timers.entries()]) {
      if (!seenWaiting.has(id)) {
        clearTimer(record.handle);
        timers.delete(id);
      }
    }
  };

  const dispose = () => {
    for (const record of timers.values()) clearTimer(record.handle);
    timers.clear();
  };

  return Object.freeze({ update, dispose });
}
