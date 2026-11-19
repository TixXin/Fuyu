import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Context } from "@fuyu/plugin-base";
import { todosV1 } from "@fuyu/plugin-services";
import {
  EMPTY_PROGRESS,
  METHODS,
  OVERDUE_DAYS,
  TOPICS,
  buildProgress,
  msUntilNextDay,
  normalizeSettings,
  normalizeStored,
  shiftDate,
  type DayTodos,
  type RingProgress,
  type RingSettings,
  type RingSnapshot,
} from "./model.ts";

export const name = "@fuyu/todo-ring";
export const inject = ["clients", "todos/v1"];

export function apply(ctx: Context) {
  const todos = ctx.services.get(todosV1);
  const stateFile = join(ctx.dataDir, "todo-ring.json");
  let settings: RingSettings = readSettings();
  let progress: RingProgress = { ...EMPTY_PROGRESS };
  let error: RingSnapshot["error"] = null;
  let loadedAt = 0;
  let todayIds = new Set<string>();

  function readSettings(): RingSettings {
    try {
      return normalizeStored(JSON.parse(readFileSync(stateFile, "utf8")));
    } catch {
      return normalizeStored(null);
    }
  }

  function saveSettings() {
    try {
      mkdirSync(ctx.dataDir, { recursive: true });
      writeFileSync(stateFile, `${JSON.stringify({ settings }, null, 2)}\n`, "utf8");
    } catch {}
  }

  function snapshot(): RingSnapshot {
    return { ...progress, error, settings, at: Date.now() };
  }

  function publish(): RingSnapshot {
    const next = snapshot();
    ctx.clients.publish(TOPICS.snapshot, next);
    return next;
  }

  async function pastDays(today: string): Promise<DayTodos[]> {
    const { days } = await todos.days({ from: shiftDate(today, -OVERDUE_DAYS), to: shiftDate(today, -1) });
    const open = days.filter((day) => day.total > day.completed && day.date < today);
    return Promise.all(open.map((day) => todos.list({ date: day.date })));
  }

  async function refresh(): Promise<RingSnapshot> {
    try {
      const today = await todos.list({});
      const past = settings.scope === "overdue" ? await pastDays(today.date).catch(() => []) : [];
      progress = buildProgress(today, past, settings.scope);
      todayIds = new Set((Array.isArray(today.todos) ? today.todos : []).map((item) => item.id));
      error = null;
      loadedAt = Date.now();
    } catch {
      error = "unavailable";
    }
    return publish();
  }

  const scheduleDay = () => {
    ctx.setTimeout(() => {
      void refresh();
      scheduleDay();
    }, msUntilNextDay(Date.now()));
  };
  scheduleDay();

  todos.on("changed", () => {
    void refresh();
  });
  void refresh();

  const idOf = (params: unknown) => {
    const id = (params as { id?: unknown } | undefined)?.id;
    return typeof id === "string" ? id.trim() : "";
  };

  ctx.clients.handle(METHODS.snapshot, async () => (loadedAt === 0 ? refresh() : snapshot()));

  ctx.clients.handle(METHODS.complete, async (params?: { id?: string }) => {
    const id = idOf(params);
    if (!settings.clickToComplete || !todayIds.has(id)) return snapshot();
    await todos.update({ id, completed: true });
    return refresh();
  });

  ctx.clients.handle(METHODS.reopen, async (params?: { id?: string }) => {
    const id = idOf(params);
    if (!todayIds.has(id)) return snapshot();
    await todos.update({ id, completed: false });
    return refresh();
  });

  ctx.clients.handle(METHODS.setSettings, async (params?: Partial<RingSettings>) => {
    const scopeBefore = settings.scope;
    settings = normalizeSettings(params, settings);
    saveSettings();
    return settings.scope === scopeBefore ? publish() : refresh();
  });
}
