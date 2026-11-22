import assert from "node:assert/strict";
import test from "node:test";
import { anyNotchText, changedTexts, routeNotchText } from "../../src/windows/island/notchText.ts";
import { DEFAULT_NOTCH_TEXT, readNotchText } from "../../src/lib/settings/collapsedText.ts";

const line = (item, extra = {}) => ({ kind: "line", item, priority: 0, ...extra });
const TODO = line("todos.title", { measure: "写周报", label: "当前任务：写周报" });
const LYRIC = line("media.lyric", { measure: "MM最长的一句", label: "正在播放：第一句" });
const AGENT = line("agent-status.session", { measure: "MM修复登录", label: "Claude：修复登录" });
const MEETING = line("calendar.meeting", { bare: true });
const modes = (overrides) => ({ ...DEFAULT_NOTCH_TEXT, ...overrides });

test("by default every kind of text goes to the +N panel and nothing takes the row under the notch", () => {
  const route = routeNotchText([TODO, LYRIC, AGENT, MEETING], DEFAULT_NOTCH_TEXT, new Set());
  assert.deepEqual(route.panel.map((entry) => entry.item), ["todos.title", "media.lyric", "agent-status.session", "calendar.meeting"]);
  assert.equal(route.row, null);
});

test("an always-on row takes the first such line in priority order; hidden kinds go nowhere", () => {
  const route = routeNotchText([AGENT, LYRIC, TODO], modes({ lyrics: "row", todos: "row", agent: "off" }), new Set());
  assert.equal(route.row?.item, "media.lyric");
  assert.deepEqual(route.panel, []);
});

test("a flashing kind takes the row only while it is flashing", () => {
  const set = modes({ agent: "flash" });
  assert.equal(routeNotchText([AGENT], set, new Set()).row, null);
  assert.equal(routeNotchText([AGENT], set, new Set(["agent-status.session"])).row?.item, "agent-status.session");
});

test("reserved, dropped, always-on and unknown lines are left alone", () => {
  const route = routeNotchText([line("media.lyric", { reserve: true }), line("translation.peek", { drop: true }), line("todos.title", { always: true }), line("plugin.text")], modes({ todos: "row" }), new Set());
  assert.equal(route.row, null);
  assert.deepEqual(route.panel, []);
});

test("a change is a new to-do or agent label, a new song for lyrics, or a line that appears", () => {
  const first = changedTexts(new Map(), [TODO, LYRIC, MEETING]);
  assert.deepEqual(first.changed, ["todos.title", "media.lyric", "calendar.meeting"]);
  const nextLyric = { ...LYRIC, label: "正在播放：第二句" };
  assert.deepEqual(changedTexts(first.now, [TODO, nextLyric, MEETING]).changed, [], "the next lyric of the same song is not a change");
  const newSong = { ...LYRIC, measure: "MM另一首歌" };
  assert.deepEqual(changedTexts(first.now, [TODO, newSong, MEETING]).changed, ["media.lyric"]);
  assert.deepEqual(changedTexts(first.now, [{ ...TODO, label: "当前任务：回邮件" }]).changed, ["todos.title"]);
});

test("an agent line that starts interjecting is a change, and calming down again is not", () => {
  const calm = changedTexts(new Map(), [AGENT]).now;
  const loud = changedTexts(calm, [{ ...AGENT, priority: 50, interjection: true }]);
  assert.deepEqual(loud.changed, ["agent-status.session"]);
  assert.deepEqual(changedTexts(loud.now, [AGENT]).changed, []);
  assert.deepEqual(changedTexts(loud.now, [{ ...AGENT, priority: 50, interjection: true }]).changed, []);
});

test("stored modes are read per kind, falling back to the panel for anything unknown or broken", () => {
  assert.deepEqual(readNotchText(null), DEFAULT_NOTCH_TEXT);
  assert.deepEqual(readNotchText("{"), DEFAULT_NOTCH_TEXT);
  assert.deepEqual(readNotchText(JSON.stringify({ version: 2, notch: { todos: "off" } })), DEFAULT_NOTCH_TEXT);
  assert.deepEqual(readNotchText(JSON.stringify({ version: 1, notch: { todos: "off", lyrics: "loud", agent: "flash" } })), modes({ todos: "off", agent: "flash" }));
  assert.equal(anyNotchText(modes({ todos: "off", lyrics: "off", agent: "off", meeting: "off" })), false);
  assert.equal(anyNotchText(DEFAULT_NOTCH_TEXT), true);
});
