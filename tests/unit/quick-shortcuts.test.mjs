import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  calendarShortcutConfigValue,
  readCalendarJoinShortcut,
  resolveJoinShortcutTarget,
} from "../../src/features/calendar/plugin/joinShortcut.ts";
import {
  cancelQuickAdd,
  IDLE_QUICK_ADD,
  readTodoQuickAddShortcut,
  syncQuickAddIsland,
  todoShortcutConfigValue,
  triggerQuickAdd,
} from "../../src/features/todos/plugin/quickAdd.ts";

const BUILTINS_PATH = fileURLToPath(new URL("../../src/features/builtins.json", import.meta.url));
const catalog = JSON.parse(readFileSync(BUILTINS_PATH, "utf8"));

test("todos and calendar declare shortcuts in builtins.json background", () => {
  const todos = catalog.plugins.find((plugin) => plugin.id === "todos");
  const calendar = catalog.plugins.find((plugin) => plugin.id === "calendar");
  assert.deepEqual(todos?.background, ["shortcuts"]);
  assert.deepEqual(calendar?.background, ["shortcuts"]);
});

test("todo quick-add and calendar join shortcuts default to empty and normalize config values", () => {
  assert.equal(readTodoQuickAddShortcut({}), "");
  assert.equal(readTodoQuickAddShortcut({ quickAddShortcut: " Alt+Shift+T " }), "Alt+Shift+T");
  assert.equal(readTodoQuickAddShortcut({ quickAddShortcut: "   " }), "");
  assert.equal(readTodoQuickAddShortcut({ quickAddShortcut: 42 }), "");
  assert.equal(todoShortcutConfigValue(" Alt+Shift+T "), "Alt+Shift+T");
  assert.equal(todoShortcutConfigValue("   "), null);

  assert.equal(readCalendarJoinShortcut({}), "");
  assert.equal(readCalendarJoinShortcut({ joinShortcut: " Alt+Shift+J " }), "Alt+Shift+J");
  assert.equal(readCalendarJoinShortcut({ joinShortcut: "" }), "");
  assert.equal(readCalendarJoinShortcut({ joinShortcut: false }), "");
  assert.equal(calendarShortcutConfigValue(" Alt+Shift+J "), "Alt+Shift+J");
  assert.equal(calendarShortcutConfigValue(""), null);
});

test("quick-add session opens todo today view, focuses once, and collapses when a todo is added", () => {
  assert.equal(triggerQuickAdd(IDLE_QUICK_ADD, { enabled: false, itemIds: ["t:1"] }), IDLE_QUICK_ADD);

  const opened = triggerQuickAdd(IDLE_QUICK_ADD, { enabled: true, itemIds: ["t:1"] });
  assert.equal(opened.phase, "opening");

  const stillCollapsed = syncQuickAddIsland(opened, {
    mode: "collapsed",
    page: "calendar",
    pageMode: "today",
    itemIds: ["t:1"],
  });
  assert.equal(stillCollapsed.shouldFocus, false);
  assert.equal(stillCollapsed.shouldCollapse, false);
  assert.equal(stillCollapsed.session.phase, "opening");

  const expanded = syncQuickAddIsland(opened, {
    mode: "expanded",
    page: "todo",
    pageMode: "today",
    itemIds: ["t:1"],
  });
  assert.equal(expanded.shouldFocus, true);
  assert.equal(expanded.shouldCollapse, false);
  assert.equal(expanded.session.phase, "active");

  const settled = syncQuickAddIsland(expanded.session, {
    mode: "expanded",
    page: "todo",
    pageMode: "today",
    itemIds: ["t:1"],
  });
  assert.equal(settled.shouldFocus, false);
  assert.equal(settled.shouldCollapse, false);

  const refocused = triggerQuickAdd(settled.session, { enabled: true, itemIds: ["t:1"] });
  const afterRefocus = syncQuickAddIsland(refocused, {
    mode: "expanded",
    page: "todo",
    pageMode: "today",
    itemIds: ["t:1"],
  });
  assert.equal(afterRefocus.shouldFocus, true);
  assert.equal(afterRefocus.shouldCollapse, false);

  const submitted = syncQuickAddIsland(afterRefocus.session, {
    mode: "expanded",
    page: "todo",
    pageMode: "today",
    itemIds: ["t:2", "t:1"],
  });
  assert.equal(submitted.shouldCollapse, true);
  assert.equal(submitted.shouldFocus, false);
  assert.equal(submitted.session.phase, "idle");
});

test("quick-add session collapses on scheduled todo addition or Escape, and resets if user leaves the todo page", () => {
  const active = syncQuickAddIsland(triggerQuickAdd(IDLE_QUICK_ADD, { enabled: true, itemIds: ["t:1"] }), {
    mode: "expanded",
    page: "todo",
    pageMode: "today",
    itemIds: ["t:1"],
  }).session;

  const scheduled = syncQuickAddIsland(active, {
    mode: "expanded",
    page: "todo",
    pageMode: "today",
    itemIds: ["t:1", "s:later"],
  });
  assert.equal(scheduled.shouldCollapse, true);
  assert.equal(scheduled.session.phase, "idle");

  const cancelled = cancelQuickAdd(active);
  assert.equal(cancelled.shouldCollapse, true);
  assert.equal(cancelled.session.phase, "idle");
  assert.equal(cancelQuickAdd(IDLE_QUICK_ADD).shouldCollapse, false);

  const switchedPage = syncQuickAddIsland(active, {
    mode: "expanded",
    page: "calendar",
    pageMode: "today",
    itemIds: ["t:1"],
  });
  assert.equal(switchedPage.shouldCollapse, false);
  assert.equal(switchedPage.session.phase, "idle");

  const normalAdd = syncQuickAddIsland(switchedPage.session, {
    mode: "expanded",
    page: "todo",
    pageMode: "today",
    itemIds: ["t:1", "t:3"],
  });
  assert.equal(normalAdd.shouldCollapse, false);
});

test("calendar join shortcut resolves meeting link and pauseMedia preference only when a joinable meeting is active", () => {
  assert.deepEqual(
    resolveJoinShortcutTarget({
      enabled: true,
      upcoming: { event: { meetingLink: " https://meet.example.com/room-1 " } },
      pauseMediaOnJoin: true,
    }),
    { link: "https://meet.example.com/room-1", pauseMedia: true },
  );
  assert.deepEqual(
    resolveJoinShortcutTarget({
      enabled: true,
      upcoming: { event: { meetingLink: "https://zoom.us/j/123" } },
      pauseMediaOnJoin: false,
    }),
    { link: "https://zoom.us/j/123", pauseMedia: false },
  );
  assert.equal(
    resolveJoinShortcutTarget({
      enabled: false,
      upcoming: { event: { meetingLink: "https://meet.example.com/room-1" } },
      pauseMediaOnJoin: true,
    }),
    null,
  );
  assert.equal(
    resolveJoinShortcutTarget({
      enabled: true,
      upcoming: { event: { meetingLink: null } },
      pauseMediaOnJoin: true,
    }),
    null,
  );
  assert.equal(
    resolveJoinShortcutTarget({
      enabled: true,
      upcoming: { event: { meetingLink: "   " } },
      pauseMediaOnJoin: true,
    }),
    null,
  );
  assert.equal(
    resolveJoinShortcutTarget({
      enabled: true,
      upcoming: null,
      pauseMediaOnJoin: true,
    }),
    null,
  );
});
