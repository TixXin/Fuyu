import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Context } from "@fuyu/plugin-base";
import { messagesV1, timersV1, todosV1, type Timer } from "@fuyu/plugin-services";
import {
  METHODS,
  TOPICS,
  isPaused,
  isTicking,
  msUntilNextDay,
  nextBreak,
  applySettings,
  normalizeStored,
  phaseMinutes,
  remainingMs,
  settingsOf,
  todayKey,
  type BreakKind,
  type OpenTodoItem,
  type Phase,
  type PomodoroSettings,
  type PomodoroSnapshot,
  type StoredPomodoro,
} from "./model.ts";
import { COMMAND_TITLES, text } from "./text.ts";

export const name = "@fuyu/pomodoro";
export const inject = ["clients", "commands", "timers/v1", "todos/v1", "messages/v1"];

const T = text.notice;


function readStored(file: string): StoredPomodoro {
  try {
    return normalizeStored(JSON.parse(readFileSync(file, "utf8")));
  } catch {
    return normalizeStored(null);
  }
}

export function apply(ctx: Context) {
  const timers = ctx.services.get(timersV1);
  const todos = ctx.services.get(todosV1);
  const messages = ctx.services.get(messagesV1);
  const stateFile = join(ctx.dataDir, "pomodoro.json");

  let stored = readStored(stateFile);
  let activeTimer: Timer | null = null;
  let openTodos: OpenTodoItem[] = [];
  let stopTick: (() => Promise<void>) | null = null;
  let completing = false;
  let starting = 0;

  function rollDay() {
    const today = todayKey();
    if (stored.date === today) return;
    stored.date = today;
    stored.rounds = 0;
    stored.streak = 0;
    stored.breakDue = null;
  }

  function save() {
    rollDay();
    try {
      mkdirSync(ctx.dataDir, { recursive: true });
      writeFileSync(stateFile, `${JSON.stringify(stored, null, 2)}\n`, "utf8");
    } catch {}
  }

  function snapshot(at = Date.now()): PomodoroSnapshot {
    rollDay();
    return {
      timer: activeTimer,
      at,
      phase: stored.activeTimerId ? stored.phase : null,
      activeTodoId: stored.activeTodoId,
      activeLabel: stored.activeLabel,
      rounds: stored.rounds,
      breakDue: stored.breakDue,
      openTodos,
      settings: settingsOf(stored),
      timersHidden: stored.timersHidden,
    };
  }

  function syncTicker(at: number) {
    const ticking = isTicking(activeTimer, at);
    if (ticking && !stopTick) {
      stopTick = ctx.setInterval(() => ctx.clients.publish(TOPICS.snapshot, snapshot()), 1000);
    } else if (!ticking && stopTick) {
      void stopTick();
      stopTick = null;
    }
  }

  function publish(at = Date.now()): PomodoroSnapshot {
    syncTicker(at);
    const next = snapshot(at);
    ctx.clients.publish(TOPICS.snapshot, next);
    return next;
  }

  function clearActive() {
    stored.phase = null;
    stored.activeTimerId = null;
    stored.activeTodoId = null;
    stored.activeLabel = "";
    activeTimer = null;
  }

  async function removeActive() {
    const previous = stored.activeTimerId;
    clearActive();
    if (previous) await timers.remove({ id: previous }).catch(() => {});
  }

  async function loadTodos() {
    const day = await todos.list({});
    openTodos = day.todos.filter((item) => !item.completed).map((item) => ({ id: item.id, title: item.title }));
  }

  async function refreshTodos() {
    try {
      await loadTodos();
      publish();
    } catch {}
  }

  async function findTodo(todoId: unknown): Promise<OpenTodoItem | null> {
    const wanted = typeof todoId === "string" ? todoId.trim() : "";
    if (!wanted) return null;
    let match = openTodos.find((item) => item.id === wanted);
    if (!match) {
      await loadTodos().catch(() => {});
      match = openTodos.find((item) => item.id === wanted);
    }
    return match ?? null;
  }

  async function startPhase(phase: Phase, todoId: unknown = null): Promise<PomodoroSnapshot> {
    await removeActive();
    rollDay();
    const todo = phase === "focus" ? await findTodo(todoId) : null;
    const durationMs = phaseMinutes(phase, stored) * 60_000;
    starting += 1;
    let started: { timer: Timer };
    try {
      started = await timers.start({ kind: "countdown", durationMs, hidden: true });
    } finally {
      starting -= 1;
    }
    stored.timersHidden = started.timer.hidden === true;
    stored.phase = phase;
    stored.activeTimerId = started.timer.id;
    stored.activeTodoId = todo?.id ?? null;
    stored.activeLabel = todo?.title ?? "";
    stored.breakDue = null;
    if (phase === "focus") stored.lastTodoId = todo?.id ?? null;
    if (phase === "long") stored.streak = 0;
    activeTimer = started.timer;
    save();
    return publish();
  }

  function startBreak(): Promise<PomodoroSnapshot> {
    return startPhase(stored.breakDue ?? nextBreak(stored.streak, stored));
  }

  async function setPaused(paused: boolean): Promise<PomodoroSnapshot> {
    const id = stored.activeTimerId;
    const at = Date.now();
    if (id && (paused ? isTicking(activeTimer, at) : isPaused(activeTimer, at))) {
      const result = await (paused ? timers.pause({ id }) : timers.resume({ id }));
      activeTimer = result.timer;
    }
    return publish();
  }

  async function stop(): Promise<PomodoroSnapshot> {
    await removeActive();
    save();
    return publish();
  }

  function notify(title: string, body: string, actions: string[]) {
    return messages.notify({ source: name, pluginId: name, title, body, durationMs: 10_000, actions }).catch(() => {});
  }

  function countText() {
    const goal = stored.dailyGoal;
    const count = T.count(stored.rounds, goal);
    return goal > 0 && stored.rounds === goal ? `${count} · ${T.goalReached}` : count;
  }

  async function recordFocus(todoId: string, focusedMs: number) {
    const minutes = Math.round(focusedMs / 60_000);
    if (minutes < 1) return;
    await todos.update({ id: todoId, addFocusMinutes: minutes }).catch(() => {});
  }

  async function finishFocus(label: string) {
    stored.rounds += 1;
    stored.streak += 1;
    const kind: BreakKind = nextBreak(stored.streak, stored);
    const count = countText();
    const body = label ? `${label} · ${count}` : count;
    if (stored.autoStartBreak) {
      await startPhase(kind);
      await notify(T.focusDone, `${body} · ${T.breakStarted(kind, phaseMinutes(kind, stored))}`, [T.again]);
      return;
    }
    stored.breakDue = kind;
    save();
    publish();
    await notify(T.focusDone, body, [T.takeBreak, T.again]);
  }

  async function finishBreak() {
    if (stored.autoStartFocus) {
      await startPhase("focus", stored.lastTodoId);
      await notify(T.breakDone, T.focusStarted(stored.rounds + 1), []);
      return;
    }
    save();
    publish();
    await notify(T.breakDone, countText(), [T.again]);
  }

  async function completePhase(timerId: string) {
    if (completing || stored.activeTimerId !== timerId) return;
    completing = true;
    try {
      rollDay();
      const phase = stored.phase ?? "focus";
      const label = stored.activeLabel;
      const todoId = stored.activeTodoId;
      const focusedMs = activeTimer?.id === timerId ? activeTimer.durationMs : phaseMinutes("focus", stored) * 60_000;
      clearActive();
      await timers.remove({ id: timerId }).catch(() => {});
      if (stored.sound) ctx.clients.publish(TOPICS.chime, { at: Date.now() });
      if (phase === "focus" && todoId) await recordFocus(todoId, focusedMs);
      if (phase === "focus") await finishFocus(label);
      else await finishBreak();
    } finally {
      completing = false;
    }
  }

  function sweepOrphans(list: Timer[]) {
    if (starting > 0) return;
    for (const timer of list) {
      if (timer.hidden === true && timer.owner === name && timer.id !== stored.activeTimerId) {
        void timers.remove({ id: timer.id }).catch(() => {});
      }
    }
  }

  function handleTimers(list: { timers: Timer[]; at: number }) {
    sweepOrphans(list.timers);
    if (!stored.activeTimerId) {
      activeTimer = null;
      publish(list.at);
      return;
    }
    const found = list.timers.find((item) => item.id === stored.activeTimerId) ?? null;
    if (!found) {
      clearActive();
      save();
      publish(list.at);
      return;
    }
    activeTimer = found;
    if (found.alerted || remainingMs(found, list.at) <= 0) {
      void completePhase(found.id);
      return;
    }
    publish(list.at);
  }

  function scheduleDayRoll() {
    ctx.setTimeout(() => {
      save();
      void refreshTodos();
      scheduleDayRoll();
    }, msUntilNextDay());
  }

  timers.on("changed", handleTimers);
  timers.on("due", ({ timer }) => {
    if (timer.id === stored.activeTimerId) void completePhase(timer.id);
  });
  todos.on("changed", () => {
    void refreshTodos();
  });
  messages.on("action", ({ pluginId, action }) => {
    if (pluginId !== name) return;
    if (action === T.again) void startPhase("focus", stored.lastTodoId).catch(() => {});
    else if (action === T.takeBreak) void startBreak().catch(() => {});
  });

  void timers.list().then(handleTimers, () => {});
  void refreshTodos();
  scheduleDayRoll();

  const startCommand = (args?: { todoId?: unknown }) => {
    const at = Date.now();
    if (isPaused(activeTimer, at)) return setPaused(false);
    if (stored.phase === "focus" && isTicking(activeTimer, at)) return snapshot(at);
    return startPhase("focus", args?.todoId ?? null);
  };
  const togglePause = () => setPaused(isTicking(activeTimer, Date.now()));

  ctx.commands.register("start", startCommand, { title: COMMAND_TITLES.start, keybinding: "Ctrl+Alt+P" });
  ctx.commands.register("stop", stop, { title: COMMAND_TITLES.stop });
  ctx.commands.register("pause", togglePause, { title: COMMAND_TITLES.pause });

  ctx.clients.handle(METHODS.snapshot, () => snapshot());
  ctx.clients.handle(METHODS.start, (params?: { todoId?: unknown }) => startPhase("focus", params?.todoId ?? null));
  ctx.clients.handle(METHODS.startBreak, () => startBreak());
  ctx.clients.handle(METHODS.pause, () => setPaused(true));
  ctx.clients.handle(METHODS.resume, () => setPaused(false));
  ctx.clients.handle(METHODS.stop, () => stop());
  ctx.clients.handle(METHODS.setSettings, (params?: Partial<PomodoroSettings>) => {
    stored = applySettings(stored, params);
    save();
    return publish();
  });
}
