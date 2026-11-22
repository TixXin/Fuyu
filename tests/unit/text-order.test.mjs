import assert from "node:assert/strict";
import test from "node:test";
import { aggregateContributions, LINE_PRIORITY } from "../../src/features/plugin-kernel/islandContributions.ts";
import { textRanks } from "../../src/features/plugin-kernel/textRanks.ts";
import { lyricsBeforeAgent, readCollapsedText, saveCollapsedText, saveNotchText, textOrder, COLLAPSED_TEXT_KEY, DEFAULT_NOTCH_TEXT } from "../../src/lib/settings/collapsedText.ts";

const line = (item, priority) => ({ kind: "line", item, priority });
const sorted = (lines) => aggregateContributions([lines], true).lines.map((entry) => entry.item);

function barWith(ranks, interjecting = false) {
  return sorted([
    line("todos.count", ranks.todoCount),
    line("todos.title", ranks.todoTitle),
    line("media.lyric", ranks.lyrics),
    line("agent-status.session", interjecting ? ranks.agentInterjection : ranks.agent),
    line("calendar.meeting", ranks.meeting),
    line("translation.peek", LINE_PRIORITY.peek),
  ].filter((entry) => entry.priority !== null));
}

const OLD = {
  lyrics: { meeting: LINE_PRIORITY.meeting, lyrics: LINE_PRIORITY.lyricsFirst, agent: LINE_PRIORITY.agentTitle, agentInterjection: LINE_PRIORITY.agentInterjection, todoTitle: LINE_PRIORITY.todoTitle, todoCount: LINE_PRIORITY.todoCount },
  agent: { meeting: LINE_PRIORITY.meeting, lyrics: LINE_PRIORITY.lyrics, agent: LINE_PRIORITY.agentTitle, agentInterjection: LINE_PRIORITY.agentInterjection, todoTitle: LINE_PRIORITY.todoTitle, todoCount: LINE_PRIORITY.todoCount },
};

test("without a saved order the old lyrics-or-agent choice gives the same bar as before", () => {
  for (const priority of ["lyrics", "agent"]) {
    const ranks = textRanks(textOrder(null, priority));
    for (const interjecting of [false, true]) {
      assert.deepEqual(barWith(ranks, interjecting), barWith(OLD[priority], interjecting), `${priority}, interjecting ${interjecting}`);
    }
  }
  assert.deepEqual(textOrder(null, "lyrics"), ["meeting", "lyrics", "agent", "todos"]);
  assert.deepEqual(textOrder(null, "agent"), ["meeting", "agent", "lyrics", "todos"]);
  assert.equal(lyricsBeforeAgent(textOrder(null, "lyrics")), true);
  assert.equal(lyricsBeforeAgent(textOrder(null, "agent")), false);
});

test("a saved order wins over the old choice and the bar follows it, temporary peeks still first", () => {
  const order = textOrder(["todos", "agent", "meeting", "lyrics"], "lyrics");
  assert.deepEqual(barWith(textRanks(order)), ["translation.peek", "todos.title", "todos.count", "agent-status.session", "calendar.meeting", "media.lyric"]);
  assert.equal(lyricsBeforeAgent(order), false);
});

test("an agent that finishes a turn moves up to second place, or stays first", () => {
  const second = textRanks(textOrder(["todos", "lyrics", "meeting", "agent"], "lyrics"));
  assert.deepEqual(barWith(second, true).slice(1, 3), ["todos.title", "agent-status.session"]);
  const first = textRanks(textOrder(["agent", "meeting", "lyrics", "todos"], "lyrics"));
  assert.deepEqual(barWith(first, true).slice(1, 3), ["agent-status.session", "calendar.meeting"]);
});

test("hidden kinds get no rank and leave the bar", () => {
  const ranks = textRanks(textOrder(null, "lyrics"), ["lyrics", "todos"]);
  assert.equal(ranks.lyrics, null);
  assert.equal(ranks.todoCount, null);
  assert.deepEqual(barWith(ranks), ["translation.peek", "calendar.meeting", "agent-status.session"]);
  assert.equal(textRanks(textOrder(null, "lyrics"), ["agent"]).agentInterjection, null);
});

test("stored order and hidden kinds are cleaned up when read; a short order is completed", () => {
  const read = readCollapsedText(JSON.stringify({ version: 1, order: ["todos", "todos", "plugin", "agent"], hidden: ["meeting", "nope"] }));
  assert.deepEqual(read.order, ["todos", "agent"]);
  assert.deepEqual(read.hidden, ["meeting"]);
  assert.deepEqual(read.notch, DEFAULT_NOTCH_TEXT);
  assert.deepEqual(textOrder(read.order, "agent"), ["todos", "agent", "meeting", "lyrics"]);
  assert.equal(readCollapsedText(JSON.stringify({ version: 1, order: [] })).order, null);
});

test("saving the notch modes keeps the order, and an all-default value removes the key", () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: (key) => store.delete(key) };
  globalThis.window = { dispatchEvent: () => true };
  globalThis.StorageEvent ??= class StorageEvent { constructor(type, init) { this.type = type; this.key = init?.key ?? null; } };
  try {
    saveCollapsedText({ order: ["todos", "meeting", "lyrics", "agent"], hidden: ["lyrics"] });
    saveNotchText({ ...DEFAULT_NOTCH_TEXT, todos: "row" });
    assert.deepEqual(JSON.parse(store.get(COLLAPSED_TEXT_KEY)), { version: 1, notch: { ...DEFAULT_NOTCH_TEXT, todos: "row" }, order: ["todos", "meeting", "lyrics", "agent"], hidden: ["lyrics"] });
    saveCollapsedText({ order: null, hidden: [], notch: DEFAULT_NOTCH_TEXT });
    assert.equal(store.has(COLLAPSED_TEXT_KEY), false);
  } finally {
    delete globalThis.localStorage;
    delete globalThis.window;
  }
});
