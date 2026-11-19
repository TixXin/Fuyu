import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Context } from "@fuyu/plugin-base";
import { messagesV1, todosV1 } from "@fuyu/plugin-services";
import { buildDigest, placeBlock } from "./digest.ts";
import {
  EMPTY_STATE,
  METHODS,
  TOPICS,
  autoWriteDue,
  clockOf,
  dateKey,
  normalizeSettings,
  normalizeStored,
  type DigestState,
  type DigestTodo,
  type StoredDigest,
  type WriteOutcome,
} from "./model.ts";
import { text } from "./text.ts";

export const name = "@fuyu/todo-digest";
export const inject = ["clients", "commands", "todos/v1"];

const TICK_MS = 30_000;

function msUntilNextDay(now: number): number {
  const at = new Date(now);
  const next = new Date(at.getFullYear(), at.getMonth(), at.getDate() + 1, 0, 0, 1);
  return Math.max(1000, next.getTime() - now);
}

export function apply(ctx: Context) {
  const todos = ctx.services.get(todosV1);
  const messages = ctx.services.get(messagesV1);
  const stateFile = join(ctx.dataDir, "todo-digest.json");
  let stored: StoredDigest = readStored();
  let latest: DigestState = { ...EMPTY_STATE, settings: stored.settings };
  let loadedDay = "";
  let queue: Promise<unknown> = Promise.resolve();

  function readStored(): StoredDigest {
    try {
      return normalizeStored(JSON.parse(readFileSync(stateFile, "utf8")));
    } catch {
      return normalizeStored(null);
    }
  }

  function save() {
    try {
      mkdirSync(ctx.dataDir, { recursive: true });
      writeFileSync(stateFile, `${JSON.stringify(stored, null, 2)}\n`, "utf8");
    } catch {}
  }

  function publish(patch: Partial<DigestState> = {}): DigestState {
    latest = { ...latest, ...patch, settings: stored.settings, at: Date.now() };
    ctx.clients.publish(TOPICS.state, latest);
    return latest;
  }

  async function refresh(): Promise<DigestState> {
    try {
      const day = await todos.list({});
      const list: DigestTodo[] = (Array.isArray(day.todos) ? day.todos : []).map((item) => ({
        id: item.id,
        title: item.title,
        completed: item.completed === true,
        ...(item.project ? { project: item.project } : {}),
      }));
      loadedDay = dateKey(Date.now());
      const lastWrittenAt = stored.lastWrite?.date === day.date ? stored.lastWrite.at : null;
      return publish({
        date: day.date,
        total: list.length,
        openCount: list.filter((item) => !item.completed).length,
        todos: list,
        lastWrittenAt,
        lastOutcome: lastWrittenAt === null ? null : latest.lastOutcome,
        error: null,
      });
    } catch {
      return publish({ error: text.unavailable });
    }
  }

  async function notify(outcome: WriteOutcome, open: number) {
    if (!stored.settings.notify || outcome === "skipped") return;
    const body = open === 0 ? text.notifyDone : outcome === "replaced" ? text.notifyReplaced(open) : text.notifyWritten(open);
    await messages.notify({ source: name, pluginId: name, title: text.notifyTitle, body, durationMs: 5000 }).catch(() => {});
  }

  async function writeNow(): Promise<DigestState> {
    const state = await refresh();
    if (state.error) throw new Error(state.error);
    const at = Date.now();
    const block = buildDigest(state.todos, stored.settings, text, clockOf(at));
    if (block === null) return publish({ lastOutcome: "skipped" });

    const current = await todos.note({});
    const previous = stored.settings.replace && stored.lastWrite?.date === current.date ? stored.lastWrite.block : null;
    const placed = placeBlock(current.note, block, previous);
    const saved = await todos.setNote({ note: placed.note });
    const outcome: WriteOutcome = placed.replaced ? "replaced" : "written";

    stored = { ...stored, lastWrite: { date: saved?.date || current.date, block, at } };
    save();
    await notify(outcome, state.openCount);
    return publish({ lastWrittenAt: at, lastOutcome: outcome });
  }

  function write(): Promise<DigestState> {
    const run = queue.then(writeNow, writeNow);
    queue = run.catch(() => {});
    return run;
  }

  function tick() {
    const at = Date.now();
    if (dateKey(at) !== loadedDay) void refresh();
    if (!autoWriteDue(stored.settings, stored.lastAutoDate, at)) return;
    stored = { ...stored, lastAutoDate: dateKey(at) };
    save();
    void write().catch(() => {});
  }

  const scheduleDay = () => {
    ctx.setTimeout(() => {
      void refresh();
      scheduleDay();
    }, msUntilNextDay(Date.now()));
  };

  todos.on("changed", () => {
    void refresh();
  });
  void refresh();
  scheduleDay();
  ctx.setTimeout(tick, 5_000);
  ctx.setInterval(tick, TICK_MS);

  ctx.clients.handle(METHODS.state, async () => (latest.at === 0 ? refresh() : latest));
  ctx.clients.handle(METHODS.writeDigest, () => write());
  ctx.clients.handle(METHODS.setSettings, (params?: unknown) => {
    const before = stored.settings;
    const settings = normalizeSettings(params, before);
    const scheduleChanged = settings.autoWrite !== before.autoWrite || settings.autoTime !== before.autoTime;
    const at = Date.now();
    const lastAutoDate = scheduleChanged ? (clockOf(at) >= settings.autoTime ? dateKey(at) : null) : stored.lastAutoDate;
    stored = { ...stored, settings, lastAutoDate };
    save();
    return publish();
  });

  ctx.commands.register("write-digest", () => write(), {
    title: { "zh-CN": "写入待办摘要", en: "Write to-do digest" },
  });
}
