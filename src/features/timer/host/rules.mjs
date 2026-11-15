import { EXTEND_MS, MAX_DURATION_MS, MAX_TIMERS, dueTimers, extended, newCountdown, newStopwatch, paused, resumed } from "../timers.ts";

export function timersError(code, message) {
  return Object.assign(new Error(message), { code });
}

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

function duration(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1000 || value > MAX_DURATION_MS) {
    throw timersError("bad-duration", `timers/v1 ${field} must be a number of milliseconds from 1000 to ${MAX_DURATION_MS}, not ${typeof value === "number" ? value : typeof value}`);
  }
  return Math.round(value);
}

export function idOf(params, method) {
  if (!isObject(params) || typeof params.id !== "string" || !params.id) throw timersError("bad-params", `timers/v1 ${method} needs { id } with the id of a timer`);
  return params.id;
}

export function startTimer(timers, params, now, id) {
  if (!isObject(params) || (params.kind !== "countdown" && params.kind !== "stopwatch")) {
    throw timersError("bad-params", 'timers/v1 start needs { kind: "countdown", durationMs } or { kind: "stopwatch" }');
  }
  const timer = params.kind === "countdown" ? newCountdown(id, duration(params.durationMs, "durationMs"), now) : newStopwatch(id, now);
  if (timers.length >= MAX_TIMERS) throw timersError("limit", `there are already ${MAX_TIMERS} timers, the most there can be`);
  return { timers: [...timers, timer], timer };
}

function changer(method, params) {
  if (method === "pause") return paused;
  if (method === "resume") return resumed;
  const byMs = params.byMs === undefined ? EXTEND_MS : duration(params.byMs, "byMs");
  return (timer, now) => {
    if (timer.kind !== "countdown") throw timersError("bad-params", `timer ${timer.id} is a stopwatch; only countdowns can be extended`);
    return extended(timer, now, byMs);
  };
}

export function changeTimer(timers, method, params, now) {
  const id = idOf(params, method);
  const change = changer(method, params);
  const index = timers.findIndex((timer) => timer.id === id);
  if (index < 0) throw timersError("not-found", `there is no timer ${id}`);
  const timer = change(timers[index], now);
  if (timer === timers[index]) return { timers, timer };
  return { timers: timers.map((old, at) => (at === index ? timer : old)), timer };
}

export function ringDue(timers, now) {
  const due = new Set(dueTimers(timers, now).map((timer) => timer.id));
  if (due.size === 0) return { timers, due: [] };
  const next = timers.map((timer) => (due.has(timer.id) ? { ...paused(timer, now), alerted: true } : timer));
  return { timers: next, due: next.filter((timer) => due.has(timer.id)) };
}
