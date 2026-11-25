import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPreviewCards,
  pickVisibleCards,
  previewWidth,
} from "../../src/windows/island/hoverPreview.ts";

const LABELS = {
  agent: "AI Agent",
  meeting: "Calendar",
  music: "Music",
  unread: "Messages",
  calendar: "Calendar",
  todo: "Todos",
  clock: "Fuyu",
};

test("previewWidth grows collapsed width by 40 with a 400px minimum and expanded cap", () => {
  assert.equal(previewWidth(300, 560), 400);
  assert.equal(previewWidth(420, 560), 460);
  assert.equal(previewWidth(550, 560), 560);
});

test("buildPreviewCards orders by priority, pins urgent items, and falls back to clock when empty", () => {
  const now = new Date(2026, 10, 25, 14, 30, 0);
  const empty = buildPreviewCards([], { homePage: "todo", now, locale: "en", labels: LABELS });
  assert.equal(empty.length, 1);
  assert.equal(empty[0].kind, "clock");
  assert.equal(empty[0].title, "14:30");

  const normal = buildPreviewCards(
    [
      { item: "todo.active", label: "Write docs", page: "todo", priority: 10 },
      { item: "music.lyric", label: "Song line", page: "music", priority: 30 },
      { item: "mail.unread", label: "3 unread", page: "messages", priority: 20 },
    ],
    { homePage: "todo", now, locale: "en", labels: LABELS },
  );
  assert.deepEqual(normal.map((c) => c.kind), ["music", "unread", "todo"]);
  assert.equal(pickVisibleCards(normal).length, 3);

  const urgent = buildPreviewCards(
    [
      { item: "music.lyric", label: "Song line", page: "music", priority: 30 },
      { item: "agent.approval", label: "Claude needs approval", page: "agents", priority: 80 },
    ],
    { homePage: "todo", now, locale: "en", labels: LABELS },
  );
  const shown = pickVisibleCards(urgent);
  assert.equal(shown.length, 1);
  assert.equal(shown[0].kind, "agent");
  assert.equal(shown[0].urgent, true);
});
