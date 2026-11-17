import type { Context } from "@fuyu/plugin-base";
import { todosV1 } from "@fuyu/plugin-services";
import { EMPTY_PROGRESS, METHODS, TOPICS, type RingProgress } from "./model.ts";

export const name = "@fuyu/todo-ring";
export const inject = ["clients", "todos/v1"];

const NEXT_SHOWN = 4;

export function apply(ctx: Context) {
  const todos = ctx.services.get(todosV1);
  let latest: RingProgress = { ...EMPTY_PROGRESS };

  async function refresh(): Promise<RingProgress> {
    const day = await todos.list({});
    const pending = day.todos.filter((item) => !item.completed);
    const total = day.todos.length;
    const done = total - pending.length;
    const next = pending.slice(0, NEXT_SHOWN).map((item) => ({
      id: item.id,
      title: item.title,
      ...(item.project ? { project: item.project } : {}),
    }));
    latest = { done, total, next, at: Date.now() };
    ctx.clients.publish(TOPICS.progress, latest);
    return latest;
  }

  todos.on("changed", () => {
    void refresh().catch(() => {});
  });
  void refresh().catch(() => {});

  ctx.clients.handle(METHODS.progress, async () => {
    if (latest.at === 0) return refresh();
    return latest;
  });

  ctx.clients.handle(METHODS.refresh, () => refresh());

  ctx.clients.handle(METHODS.complete, async (params?: { id?: string }) => {
    const id = typeof params?.id === "string" ? params.id.trim() : "";
    if (!id) return latest;
    await todos.update({ id, completed: true });
    return refresh();
  });
}
