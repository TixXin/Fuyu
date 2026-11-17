import type { WindowServices } from "@fuyu/plugin-base/client/window-services";
import { timersV1 } from "@fuyu/plugin-services";
import { MAX_TIMERS, type Timer } from "./timers.ts";

export type StartTimerResult = "ok" | "limit" | "not-ready";

export type TimerSnapshot = {
  timers: readonly Timer[];
  openRequest: { at: number; focus: boolean } | null;
};

export type TimerMigration = {
  hasLegacy(): boolean;
  loadLegacy(): Timer[];
  isMigrated(): boolean;
  markMigrated(): void;
};

export type TimerControllerServices = Pick<WindowServices, "get" | "has" | "watch">;

function errorCode(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return null;
}

function isTransient(error: unknown): boolean {
  const code = errorCode(error);
  return code === "not-ready" || code === "peer-gone";
}

export function createTimerController({
  services,
  migration,
  onRing,
  onError = (message, error) => console.error(message, error),
}: {
  services: TimerControllerServices;
  migration: TimerMigration;
  onRing: () => void;
  onError?: (message: string, error: unknown) => void;
}) {
  const client = services.get(timersV1);
  const listeners = new Set<() => void>();
  let snapshot: TimerSnapshot = {
    timers: migration.isMigrated() ? [] : migration.loadLegacy(),
    openRequest: null,
  };
  let enabled = false;
  let sound = true;
  let stopSubscriptions: (() => void) | null = null;
  let migrating: Promise<void> | null = null;
  let syncToken = 0;

  function emit(next: TimerSnapshot) {
    snapshot = next;
    for (const listener of listeners) listener();
  }

  function setTimers(timers: readonly Timer[]) {
    emit({ ...snapshot, timers });
  }

  function upsertLocal(timer: Timer) {
    syncToken += 1;
    const exists = snapshot.timers.some((item) => item.id === timer.id);
    setTimers(exists ? snapshot.timers.map((item) => (item.id === timer.id ? timer : item)) : [...snapshot.timers, timer]);
  }

  function removeLocal(id: string) {
    syncToken += 1;
    setTimers(snapshot.timers.filter((item) => item.id !== id));
  }

  function report(error: unknown) {
    if (!isTransient(error)) onError("Timer service call failed", error);
  }

  async function sync() {
    const token = ++syncToken;
    try {
      if (!services.has(timersV1.name) && !migration.isMigrated() && migration.hasLegacy()) {
        const runMigration = async () => {
          if (migration.isMigrated() || !migration.hasLegacy()) return;
          const legacy = migration.loadLegacy();
          if (legacy.length > 0) {
            const adopted = await client.adopt({ timers: legacy });
            migration.markMigrated();
            syncToken += 1;
            setTimers(adopted.timers);
            return;
          }
          const listed = await client.list();
          migration.markMigrated();
          syncToken += 1;
          setTimers(listed.timers);
        };
        migrating ??= runMigration().finally(() => {
          migrating = null;
        });
        await migrating;
        return;
      }
      const { timers } = await client.list();
      if (token === syncToken) setTimers(timers);
    } catch (error) {
      report(error);
    }
  }

  function connect() {
    const offChanged = client.on("changed", ({ timers }) => {
      syncToken += 1;
      setTimers(timers);
    });
    const offDue = client.on("due", () => {
      if (enabled && sound) onRing();
    });
    const offWatch = services.watch(() => {
      if (enabled) void sync();
    });
    void sync();
    return () => {
      offWatch();
      void Promise.resolve(offChanged()).catch(() => undefined);
      void Promise.resolve(offDue()).catch(() => undefined);
    };
  }

  async function start(params: { kind: "countdown"; durationMs: number } | { kind: "stopwatch" }): Promise<StartTimerResult> {
    if (snapshot.timers.length >= MAX_TIMERS) return "limit";
    try {
      const { timer } = await client.start(params);
      upsertLocal(timer);
      return "ok";
    } catch (error) {
      const code = errorCode(error);
      if (code === "limit") return "limit";
      report(error);
      return "not-ready";
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    configure(on: boolean, withSound: boolean) {
      sound = withSound;
      if (on === enabled) return;
      enabled = on;
      if (on) {
        stopSubscriptions = connect();
      } else {
        stopSubscriptions?.();
        stopSubscriptions = null;
      }
    },
    sync,
    startCountdown: (durationMs: number) => start({ kind: "countdown", durationMs }),
    startStopwatch: () => start({ kind: "stopwatch" }),
    pauseTimer(id: string) {
      void client.pause({ id }).then(({ timer }) => upsertLocal(timer)).catch(report);
    },
    resumeTimer(id: string) {
      void client.resume({ id }).then(({ timer }) => upsertLocal(timer)).catch(report);
    },
    cancelTimer(id: string) {
      void client.remove({ id }).then(({ removed }) => {
        if (removed) removeLocal(id);
      }).catch(report);
    },
    extendTimer(id: string) {
      void client.extend({ id }).then(({ timer }) => upsertLocal(timer)).catch(report);
    },
    dismissRinging() {
      void client.dismissRinging().then(({ removed }) => {
        if (removed > 0) {
          syncToken += 1;
          setTimers(snapshot.timers.filter((timer) => !timer.alerted));
        }
      }).catch(report);
    },
    extendRinging() {
      for (const timer of snapshot.timers) {
        if (timer.alerted) {
          void client.extend({ id: timer.id }).then(({ timer: next }) => upsertLocal(next)).catch(report);
        }
      }
    },
    requestTimerPage(focus: boolean) {
      emit({ ...snapshot, openRequest: { at: Date.now(), focus } });
    },
  };
}
