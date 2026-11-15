import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { timersV1 } from "@fuyu/plugin-services";
import { nextDueIn } from "../timers.ts";
import { DATA_FILE, readTimers, writeTimers } from "./dataFile.mjs";
import { changeTimer, idOf, ringDue, startTimer } from "./rules.mjs";

export const name = "timer";
export const RECHECK_MS = 60_000;

export function apply(ctx) {
  const file = pathToFileURL(join(ctx.dataDir, DATA_FILE));
  const logger = ctx.logger("timer");
  const loaded = readTimers(file);
  if (loaded.problem) logger.warn(`could not read ${fileURLToPath(file)}, starting with no timers: ${loaded.problem.message}`);
  let timers = loaded.timers;
  let counter = 0;
  let alarm = null;

  function save() {
    try {
      writeTimers(file, timers);
    } catch (error) {
      logger.error(`could not save the timers to ${fileURLToPath(file)}: ${error?.message ?? error}`);
    }
  }

  function commit(next, now, due = []) {
    timers = next;
    save();
    for (const timer of due) provider.emit("due", { timer, at: now });
    provider.emit("changed", { timers, at: now });
    schedule();
  }

  function schedule() {
    if (alarm) void alarm();
    alarm = null;
    const wait = nextDueIn(timers, Date.now());
    if (wait !== null) alarm = ctx.setTimeout(ring, Math.min(RECHECK_MS, wait));
  }

  function ring() {
    alarm = null;
    const now = Date.now();
    const rung = ringDue(timers, now);
    if (rung.due.length > 0) commit(rung.timers, now, rung.due);
    else schedule();
  }

  function nextId(now) {
    let id;
    do {
      counter += 1;
      id = `${now.toString(36)}-${counter}`;
    } while (timers.some((timer) => timer.id === id));
    return id;
  }

  function change(method, params) {
    const now = Date.now();
    const next = changeTimer(timers, method, params, now);
    if (next.timers !== timers) commit(next.timers, now);
    return { timer: next.timer };
  }

  const provider = ctx.services.provide(timersV1, {
    list: () => ({ timers, at: Date.now() }),
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
      const next = timers.filter((timer) => !timer.alerted);
      const removed = timers.length - next.length;
      if (removed > 0) commit(next, Date.now());
      return { removed };
    },
  });

  schedule();
}
