import type { WindowServices } from "@fuyu/plugin-base/client/window-services";
import { timersV1 } from "@fuyu/plugin-services";
import { adoptTimers, changeTimer, dismissRung, idOf, ringDue, startTimer } from "./host/rules.mjs";
import { OWNER } from "./plugin/owner.ts";
import { loadLegacyTimers, saveFallbackTimers } from "./storage.ts";
import { nextDueIn, type Timer } from "./timers.ts";

const RECHECK_MS = 60_000;

export function provideLocalTimers(services: WindowServices): () => void {
  let timers: readonly Timer[] = loadLegacyTimers();
  let counter = 0;
  let alarm: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  function clearAlarm() {
    if (alarm !== null) clearTimeout(alarm);
    alarm = null;
  }

  function schedule() {
    clearAlarm();
    if (stopped) return;
    const wait = nextDueIn(timers, Date.now());
    if (wait !== null) alarm = setTimeout(ring, Math.min(RECHECK_MS, Math.max(0, wait)));
  }

  function commit(next: readonly Timer[], now: number, due: Timer[] = []) {
    timers = next;
    saveFallbackTimers(timers);
    for (const timer of due) provider.emit("due", { timer, at: now });
    provider.emit("changed", { timers: [...timers], at: now });
    schedule();
  }

  function ring() {
    alarm = null;
    if (stopped) return;
    const now = Date.now();
    const rung = ringDue(timers, now);
    if (rung.due.length > 0) commit(rung.timers, now, rung.due);
    else schedule();
  }

  function nextId(now: number) {
    let id: string;
    do {
      counter += 1;
      id = `${now.toString(36)}-${counter}`;
    } while (timers.some((timer) => timer.id === id));
    return id;
  }

  function change(method: "pause" | "resume" | "extend", params: unknown) {
    const now = Date.now();
    const next = changeTimer(timers, method, params, now);
    if (next.timers !== timers) commit(next.timers, now);
    return { timer: next.timer };
  }

  const provider = services.provide(timersV1, {
    list: () => ({ timers: [...timers], at: Date.now() }),
    start: (params) => {
      const now = Date.now();
      const next = startTimer(timers, params, now, nextId(now));
      commit(next.timers, now);
      return { timer: next.timer };
    },
    pause: (params) => change("pause", params),
    resume: (params) => change("resume", params),
    extend: (params) => change("extend", params),
    remove: (params) => {
      const id = idOf(params, "remove");
      const next = timers.filter((timer) => timer.id !== id);
      if (next.length === timers.length) return { removed: false };
      commit(next, Date.now());
      return { removed: true };
    },
    dismissRinging: () => {
      const next = dismissRung(timers);
      const removed = timers.length - next.length;
      if (removed > 0) commit(next, Date.now());
      return { removed };
    },
    adopt: (params) => {
      const now = Date.now();
      const next = adoptTimers(timers, params, now);
      if (next.added > 0) commit(next.timers, now, next.due);
      return { timers: [...timers], added: next.added, at: now };
    },
  }, { owner: OWNER });

  schedule();

  return () => {
    stopped = true;
    clearAlarm();
    void provider.dispose();
  };
}
