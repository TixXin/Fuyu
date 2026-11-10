// The todo ring example plugin (plugins/examples/dev.focusd.todo-ring) under the mock host: the
// bar item follows the todos whether or not the page is open, and the page gets the counts and
// the next todos to do.
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { startMockHost } from "../../packages/fly-island-plugin/src/test/index.mjs";

const PLUGIN = path.resolve("plugins/examples/dev.focusd.todo-ring");
const windowsOnly = { skip: process.platform !== "win32" };
const todo = (id, completed) => ({ id, title: `待办 ${id}`, completed });

test("the bar shows done/total with a ring and the page lists what is next", windowsOnly, async () => {
  const todos = { date: "2026-11-09", scheduled: [], activeTodoId: null, todos: [todo("a", true), todo("b", false), todo("c", false), todo("d", false), todo("e", false)] };
  const host = startMockHost(PLUGIN, { todos, timeoutMs: 30000 });
  try {
    const bar = await host.waitFor((h) => h.statuses.get("progress"));
    assert.deepEqual({ text: bar.text, ring: bar.ring, tone: bar.tone }, { text: "1/5", ring: 0.2, tone: "accent" });

    // A closed page gets nothing; the bar still follows.
    host.todos.todos[1].completed = true;
    host.publish("todos.changed", { date: todos.date });
    await host.waitFor((h) => h.statuses.get("progress")?.text === "2/5");
    assert.equal(host.webviewMessages.length, 0);

    host.viewVisible("ring", true);
    host.webviewMessage("ring", { type: "ready" });
    const counts = (await host.waitFor((h) => h.webviewMessages[0])).message;
    assert.deepEqual(counts, { type: "counts", done: 2, total: 5, next: ["待办 c", "待办 d", "待办 e"] });

    // One left: still a list. None left: an empty list and a full ring.
    for (const index of [2, 3]) host.todos.todos[index].completed = true;
    host.publish("todos.changed", { date: todos.date });
    assert.deepEqual((await host.waitFor((h) => h.webviewMessages[1])).message.next, ["待办 e"]);
    host.todos.todos[4].completed = true;
    host.publish("todos.changed", { date: todos.date });
    assert.deepEqual((await host.waitFor((h) => h.webviewMessages[2])).message, { type: "counts", done: 5, total: 5, next: [] });
    assert.equal(host.statuses.get("progress").ring, 1);

    // A day without todos takes the item off the bar.
    host.todos.todos = [];
    host.publish("todos.changed", { date: todos.date });
    await host.waitFor((h) => !h.statuses.has("progress"));
  } finally {
    await host.stop();
  }
});
