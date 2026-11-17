import type { Context } from "@fuyu/plugin-base";
import { messagesV1, todosV1 } from "@fuyu/plugin-services";
import { EMPTY_STATE, METHODS, TOPICS, type DigestState, type DigestTodo } from "./model.ts";

export const name = "@fuyu/todo-digest";
export const inject = ["clients", "todos/v1", "messages/v1"];

function isZhHost(): boolean {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().startsWith("zh");
  } catch {
    return true;
  }
}

function clockOf(date = new Date()): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatDigestBlock(open: DigestTodo[], zh: boolean): string {
  const stamp = clockOf();
  const header = zh ? `[${stamp}] 未完成待办（${open.length}）` : `[${stamp}] Open todos: ${open.length}`;
  if (open.length === 0) {
    return `${header}\n${zh ? "今日待办已全部完成" : "All done"}`;
  }
  const items = open.map((item) => (item.project ? `- [${item.project}] ${item.title}` : `- ${item.title}`));
  return [header, ...items].join("\n");
}

export function apply(ctx: Context) {
  const todos = ctx.services.get(todosV1);
  const messages = ctx.services.get(messagesV1);

  let latest: DigestState = { ...EMPTY_STATE };

  async function refresh(): Promise<DigestState> {
    const day = await todos.list({});
    const open = day.todos
      .filter((item) => !item.completed)
      .map((item) => ({
        id: item.id,
        title: item.title,
        ...(item.project ? { project: item.project } : {}),
      }));
    latest = {
      date: day.date,
      total: day.todos.length,
      openCount: open.length,
      open,
      lastWrittenAt: latest.lastWrittenAt,
      at: Date.now(),
    };
    ctx.clients.publish(TOPICS.state, latest);
    return latest;
  }

  todos.on("changed", () => {
    void refresh().catch(() => {});
  });
  void refresh().catch(() => {});

  ctx.clients.handle(METHODS.state, async () => {
    if (latest.at === 0) return refresh();
    return latest;
  });

  ctx.clients.handle(METHODS.writeDigest, async () => {
    const state = await refresh();
    const zh = isZhHost();
    const block = formatDigestBlock(state.open, zh);
    const current = await todos.note({});
    const trimmed = current.note.trimEnd();
    const combined = trimmed.length > 0 ? `${trimmed}\n\n${block}` : block;
    await todos.setNote({ note: combined });

    const writtenAt = Date.now();
    latest = { ...state, lastWrittenAt: writtenAt, at: writtenAt };
    ctx.clients.publish(TOPICS.state, latest);

    await messages.notify({
      source: name,
      pluginId: name,
      title: zh ? "待办摘要已写入" : "Todo digest written",
      body: zh ? `已追加 ${state.openCount} 条未完成待办到今日笔记` : `Appended ${state.openCount} open todos to today's note`,
      durationMs: 5000,
    });

    return latest;
  });
}
