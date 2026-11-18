import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Context } from "@fuyu/plugin-base";
import { messagesV1, timersV1, todosV1, type Timer } from "@fuyu/plugin-services";
import {
  METHODS,
  POMODORO_MS,
  TOPICS,
  isTicking,
  remainingMs,
  type OpenTodoItem,
  type PomodoroSnapshot,
} from "./model.ts";

export const name = "@fuyu/pomodoro";
export const inject = ["clients", "timers/v1", "todos/v1", "messages/v1"];

type StoredState = {
  date: string;
  rounds: number;
  activeTimerId: string | null;
  activeTodoId: string | null;
  activeLabel: string;
};

function todayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isZhHost(): boolean {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().startsWith("zh");
  } catch {
    return true;
  }
}

function readStored(file: string): StoredState {
  const today = todayKey();
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<StoredState>;
    const sameDay = parsed.date === today;
    return {
      date: today,
      rounds: sameDay && typeof parsed.rounds === "number" && parsed.rounds >= 0 ? Math.floor(parsed.rounds) : 0,
      activeTimerId: typeof parsed.activeTimerId === "string" ? parsed.activeTimerId : null,
      activeTodoId: typeof parsed.activeTodoId === "string" ? parsed.activeTodoId : null,
      activeLabel: typeof parsed.activeLabel === "string" ? parsed.activeLabel : "",
    };
  } catch {
    return { date: today, rounds: 0, activeTimerId: null, activeTodoId: null, activeLabel: "" };
  }
}

export function apply(ctx: Context) {
  const timers = ctx.services.get(timersV1);
  const todos = ctx.services.get(todosV1);
  const messages = ctx.services.get(messagesV1);
  const stateFile = join(ctx.dataDir, "pomodoro.json");

  const stored = readStored(stateFile);
  let activeTimer: Timer | null = null;
  let openTodos: OpenTodoItem[] = [];
  let stopTick: (() => Promise<void>) | null = null;
  let completing = false;

  function saveStored() {
    const today = todayKey();
    if (stored.date !== today) {
      stored.date = today;
      stored.rounds = 0;
    }
    try {
      mkdirSync(ctx.dataDir, { recursive: true });
      writeFileSync(stateFile, `${JSON.stringify(stored, null, 2)}\n`, "utf8");
    } catch {}
  }

  function snapshot(at = Date.now()): PomodoroSnapshot {
    const today = todayKey();
    const rounds = stored.date === today ? stored.rounds : 0;
    return {
      timer: activeTimer,
      at,
      activeTodoId: stored.activeTodoId,
      activeLabel: stored.activeLabel,
      rounds,
      openTodos,
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

  function publish(at = Date.now()) {
    syncTicker(at);
    ctx.clients.publish(TOPICS.snapshot, snapshot(at));
  }

  async function completeRound(timerId: string) {
    if (completing || stored.activeTimerId !== timerId) return;
    completing = true;
    try {
      const today = todayKey();
      stored.rounds = (stored.date === today ? stored.rounds : 0) + 1;
      stored.date = today;
      const finishedLabel = stored.activeLabel;
      stored.activeTimerId = null;
      stored.activeTodoId = null;
      stored.activeLabel = "";
      activeTimer = null;
      saveStored();
      publish();
      await timers.remove({ id: timerId }).catch(() => {});
      const zh = isZhHost();
      const title = zh ? "番茄钟已完成" : "Pomodoro finished";
      const countText = zh ? `今日已完成 ${stored.rounds} 轮` : `Rounds today: ${stored.rounds}`;
      const body = finishedLabel ? `${finishedLabel} · ${countText}` : countText;
      await messages.notify({
        source: name,
        pluginId: name,
        title,
        body,
        durationMs: 8000,
      });
    } finally {
      completing = false;
    }
  }

  function handleTimers(list: { timers: Timer[]; at: number }) {
    if (!stored.activeTimerId) {
      activeTimer = null;
      publish(list.at);
      return;
    }
    const found = list.timers.find((item) => item.id === stored.activeTimerId) ?? null;
    if (!found) {
      stored.activeTimerId = null;
      stored.activeTodoId = null;
      stored.activeLabel = "";
      activeTimer = null;
      saveStored();
      publish(list.at);
      return;
    }
    activeTimer = found;
    if (found.alerted || remainingMs(found, list.at) <= 0) {
      void completeRound(found.id);
      return;
    }
    publish(list.at);
  }

  async function refreshTodos() {
    try {
      const day = await todos.list({});
      openTodos = day.todos.filter((item) => !item.completed).map((item) => ({ id: item.id, title: item.title }));
      publish();
    } catch {}
  }

  timers.on("changed", handleTimers);
  timers.on("due", ({ timer }) => {
    if (timer.id === stored.activeTimerId) void completeRound(timer.id);
  });
  todos.on("changed", () => {
    void refreshTodos();
  });

  void timers.list().then(handleTimers, () => {});
  void refreshTodos();

  ctx.clients.handle(METHODS.snapshot, () => snapshot());

  ctx.clients.handle(METHODS.start, async (params?: { todoId?: string | null }) => {
    if (stored.activeTimerId) {
      const previous = stored.activeTimerId;
      stored.activeTimerId = null;
      activeTimer = null;
      await timers.remove({ id: previous }).catch(() => {});
    }
    let todoId: string | null = null;
    let label = "";
    const wantedId = typeof params?.todoId === "string" && params.todoId.trim() !== "" ? params.todoId.trim() : null;
    if (wantedId) {
      let match = openTodos.find((item) => item.id === wantedId);
      if (!match) {
        const day = await todos.list({}).catch(() => null);
        if (day) {
          openTodos = day.todos.filter((item) => !item.completed).map((item) => ({ id: item.id, title: item.title }));
          match = openTodos.find((item) => item.id === wantedId);
        }
      }
      if (match) {
        todoId = match.id;
        label = match.title;
      }
    }
    const started = await timers.start({ kind: "countdown", durationMs: POMODORO_MS });
    stored.activeTimerId = started.timer.id;
    stored.activeTodoId = todoId;
    stored.activeLabel = label;
    activeTimer = started.timer;
    saveStored();
    publish();
    return snapshot();
  });

  ctx.clients.handle(METHODS.stop, async () => {
    const previous = stored.activeTimerId;
    stored.activeTimerId = null;
    stored.activeTodoId = null;
    stored.activeLabel = "";
    activeTimer = null;
    saveStored();
    if (previous) await timers.remove({ id: previous }).catch(() => {});
    publish();
    return snapshot();
  });
}
