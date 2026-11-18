import assert from "node:assert/strict";
import { test } from "node:test";
import {
  aggregateContributions,
  createIslandContributions,
  labelLine,
  leadLine,
  lineBelow,
  LINE_PRIORITY,
  measuredLine,
  selectContributed,
  shownLine,
  visibleLines,
} from "../../src/features/plugin-kernel/islandContributions.ts";

const line = (item, priority, extra = {}) => ({ kind: "line", item, priority, ...extra });

test("a contribution is stored under its owner and id and removed with it", () => {
  const store = createIslandContributions();
  let calls = 0;
  store.subscribe(() => (calls += 1));
  store.set("media", "lyrics", [line("media.lyric", 35)]);
  assert.deepEqual(store.snapshot().lines.map((entry) => entry.item), ["media.lyric"]);
  store.remove("media", "lyrics");
  assert.deepEqual(store.snapshot().lines, []);
  assert.equal(calls, 2);
});

test("writing the same contributions again does not notify", () => {
  const store = createIslandContributions();
  let calls = 0;
  store.subscribe(() => (calls += 1));
  store.set("todos", "bar", [{ kind: "hold", reason: "todo" }]);
  const first = store.snapshot();
  store.set("todos", "bar", [{ kind: "hold", reason: "todo" }]);
  assert.equal(calls, 1);
  assert.equal(store.snapshot(), first);
});

test("contributions of a switched-off owner do not count, and come back when it is on again", () => {
  const store = createIslandContributions();
  store.set("media", "bar", [line("media.lyric", 35), { kind: "hold", reason: "playing" }, { kind: "side", item: "music", height: 32 }]);
  store.set("todos", "bar", [line("todos.title", 20)]);
  store.setDisabledOwners(["media"]);
  const off = store.snapshot();
  assert.deepEqual(off.lines.map((entry) => entry.item), ["todos.title"]);
  assert.equal(off.hold, false);
  assert.equal(off.side.size, 0);
  assert.ok(store.byOwner().media, "the raw table still shows what a switched-off owner left, for the builtins-off check");
  store.setDisabledOwners([]);
  assert.equal(store.snapshot().hold, true);
});

test("settle marks the table once", () => {
  const store = createIslandContributions();
  assert.equal(store.snapshot().settled, false);
  store.settle();
  assert.equal(store.snapshot().settled, true);
});

test("lines are ordered by priority, highest first", () => {
  const { lines } = aggregateContributions([[line("todos.count", LINE_PRIORITY.todoCount)], [line("calendar.meeting", LINE_PRIORITY.meeting), line("media.lyric", LINE_PRIORITY.lyrics)]], true);
  assert.deepEqual(lines.map((entry) => entry.item), ["calendar.meeting", "media.lyric", "todos.count"]);
});

test("line helpers pick what the bar shows, measures, reads out and leads to", () => {
  const lines = [
    line("translation.peek", 70, { always: true, drop: true, label: "peek" }),
    line("calendar.meeting", 60, { page: "calendar" }),
    line("media.lyric", 45, { measure: "MMla", page: "music", lead: true, reserve: true }),
    line("todos.title", 20, { measure: "Write", label: "Task: Write" }),
  ];
  assert.equal(shownLine(lines)?.item, "translation.peek");
  assert.equal(measuredLine(lines)?.item, "media.lyric");
  assert.equal(labelLine(lines)?.item, "todos.title");
  assert.equal(leadLine(lines), null);
  assert.equal(leadLine(lines, { reserved: true })?.item, "media.lyric");
  assert.equal(lineBelow(lines, 60)?.item, "media.lyric");
  assert.deepEqual(visibleLines(lines, false).map((entry) => entry.item), ["translation.peek"]);
});

test("the other kinds are folded into one view", () => {
  const view = aggregateContributions([
    [{ kind: "alert", item: "level" }, { kind: "notice", item: "recording" }, { kind: "busy" }],
    [{ kind: "reveal", reveal: "always", pauseHover: true }, { kind: "reveal", reveal: "allowed", pauseIdle: true }],
    [{ kind: "popup", page: "agents", height: 200, open: true }, { kind: "status", state: "working", label: "Working" }],
    [{ kind: "style", vars: { "--cover": "#fff" }, className: "cover-color", tint: "#fff" }, { kind: "page", page: "qq", enabled: false }],
    [{ kind: "trail", item: "calendar.join" }, { kind: "preview", item: "messages.preview", hot: "mail" }],
    [{ kind: "summary", item: "messages.summary" }, { kind: "summary", item: "later.summary" }],
    [{ kind: "badge", target: "settings", label: "New v2", action: "updater.open" }, { kind: "badge", target: "settings", label: "later" }],
  ], false);
  assert.deepEqual([...view.alerts], ["level"]);
  assert.deepEqual([...view.notices.keys()], ["recording"]);
  assert.equal(view.busy, true);
  assert.deepEqual(view.reveal, { always: true, allowed: true, pauseIdle: true, pauseHover: true });
  assert.equal(view.popups.get("agents")?.height, 200);
  assert.equal(view.status?.state, "working");
  assert.deepEqual(view.style, { vars: { "--cover": "#fff" }, classNames: ["cover-color"], tint: "#fff" });
  assert.deepEqual(view.pages, { qq: false });
  assert.deepEqual(view.trails, ["calendar.join"]);
  assert.equal(view.preview?.hot, "mail");
  assert.equal(view.summary, "messages.summary");
  assert.equal(view.badges.get("settings")?.label, "New v2");
});

test("updating one contribution reuses unchanged style.vars and slot collections", () => {
  const store = createIslandContributions();
  store.set("media", "style", [
    { kind: "style", vars: { "--cover": "#123456" }, className: "cover-color", tint: "#123456" },
    { kind: "side", item: "music", height: 40 },
    { kind: "hint", key: "media.playing" },
  ]);
  store.set("todos", "bar", [line("todos.title", 20, { label: "First" })]);
  store.set("system", "alerts", [{ kind: "alert", item: "level" }, { kind: "page", page: "todo", enabled: true }]);
  const first = store.snapshot();

  store.set("todos", "bar", [line("todos.title", 20, { label: "Second" })]);
  const second = store.snapshot();

  assert.notEqual(second, first);
  assert.notEqual(second.lines, first.lines);
  assert.equal(second.style, first.style);
  assert.equal(second.style.vars, first.style.vars);
  assert.equal(second.style.classNames, first.style.classNames);
  assert.equal(second.side, first.side);
  assert.equal(second.hints, first.hints);
  assert.equal(second.alerts, first.alerts);
  assert.equal(second.pages, first.pages);
  assert.equal(second.reveal, first.reveal);
  assert.equal(second.notices, first.notices);
  assert.equal(second.popups, first.popups);
  assert.equal(second.badges, first.badges);
  assert.equal(second.trails, first.trails);

  const selectedStyle = selectContributed(first, null, (state) => state.style);
  const nextSelectedStyle = selectContributed(second, selectedStyle, (state) => state.style);
  assert.equal(nextSelectedStyle.value, selectedStyle.value);

  const customSelected = selectContributed(first, null, (state) => ({ hold: state.hold, hasMusic: state.hints.has("media.playing") }), (a, b) => a.hold === b.hold && a.hasMusic === b.hasMusic);
  const nextCustomSelected = selectContributed(second, customSelected, (state) => ({ hold: state.hold, hasMusic: state.hints.has("media.playing") }), (a, b) => a.hold === b.hold && a.hasMusic === b.hasMusic);
  assert.equal(nextCustomSelected.value, customSelected.value);
});
