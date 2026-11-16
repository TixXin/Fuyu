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
});
