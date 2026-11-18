import assert from "node:assert/strict";
import test from "node:test";
import { parseTodoInlineSyntax } from "../../src/features/todos/inlineSyntax.ts";
import { formatTodosAsMarkdown, getTodoSignature } from "../../src/features/todos/markdown.ts";
import { TODO_PREFS_STORAGE_KEY, loadTodoPrefs, saveTodoPrefs } from "../../src/features/todos/storage.ts";
import {
  DEFAULT_TODO_PREFS,
  filterArchivesByRetention,
  formatElapsedMinutes,
  getLogicalTodoDate,
  insertTodoItem,
  normalizeTodoPrefs,
  playTodoCompleteSound,
  sortTodos,
  todoElapsedLabel,
} from "../../src/features/todos/todoPrefs.ts";

function withStorage(entries, run) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map(entries);
  const localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage, crypto: globalThis.crypto } });
  try {
    run(values);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
    else delete globalThis.window;
  }
}

test("normalizeTodoPrefs keeps valid choices and falls back to defaults on broken or unknown values", () => {
  assert.deepEqual(normalizeTodoPrefs(undefined), DEFAULT_TODO_PREFS);
  assert.deepEqual(normalizeTodoPrefs(null), DEFAULT_TODO_PREFS);
  assert.deepEqual(normalizeTodoPrefs("broken"), DEFAULT_TODO_PREFS);

  const custom = normalizeTodoPrefs({
    showElapsed: false,
    sortBy: "priority",
    inlineSyntax: false,
    insertPosition: "top",
    completionSound: false,
    dayStartHour: 4,
    doneDisplay: "inline",
    markdownPriority: false,
    markdownElapsed: true,
    archiveRetentionDays: 180,
  });
  assert.deepEqual(custom, {
    showElapsed: false,
    sortBy: "priority",
    inlineSyntax: false,
    insertPosition: "top",
    completionSound: false,
    dayStartHour: 4,
    doneDisplay: "inline",
    markdownPriority: false,
    markdownElapsed: true,
    archiveRetentionDays: 180,
  });

  const invalid = normalizeTodoPrefs({
    showElapsed: "no",
    sortBy: "alphabetical",
    insertPosition: "middle",
    dayStartHour: 1,
    doneDisplay: "popup",
    archiveRetentionDays: 30,
  });
  assert.deepEqual(invalid, DEFAULT_TODO_PREFS);

  withStorage([[TODO_PREFS_STORAGE_KEY, "{not-json"]], () => {
    assert.deepEqual(loadTodoPrefs(), DEFAULT_TODO_PREFS);
  });
  withStorage([], (values) => {
    saveTodoPrefs({ ...DEFAULT_TODO_PREFS, dayStartHour: 4, sortBy: "priority" });
    assert.equal(loadTodoPrefs().dayStartHour, 4);
    assert.equal(loadTodoPrefs().sortBy, "priority");
    assert.ok(values.has(TODO_PREFS_STORAGE_KEY));
  });
});

test("parseTodoInlineSyntax extracts project, priority and scheduled dates and preserves raw text when disabled", () => {
  const today = "2026-11-18";

  assert.deepEqual(
    parseTodoInlineSyntax("#工作 !1 @明天 下午评审方案", today, true),
    {
      title: "下午评审方案",
      project: "工作",
      priority: "high",
      date: "2026-11-19",
    },
  );

  assert.deepEqual(
    parseTodoInlineSyntax("整理报销单 p2 @后天 #行政", today, true),
    {
      title: "整理报销单",
      project: "行政",
      priority: "medium",
      date: "2026-11-20",
    },
  );

  assert.deepEqual(
    parseTodoInlineSyntax("！3 @下周一 周会准备", today, true),
    {
      title: "周会准备",
      priority: "low",
      date: "2026-11-23",
    },
  );

  assert.deepEqual(
    parseTodoInlineSyntax("@下周日 买菜", today, true),
    {
      title: "买菜",
      date: "2026-11-29",
    },
  );

  assert.deepEqual(
    parseTodoInlineSyntax("@11-25 交材料", today, true),
    {
      title: "交材料",
      date: "2026-11-25",
    },
  );

  assert.deepEqual(
    parseTodoInlineSyntax("@01-05 元旦复盘", today, true),
    {
      title: "元旦复盘",
      date: "2027-01-05",
    },
  );

  assert.deepEqual(
    parseTodoInlineSyntax("#40 修好微信提醒", today, true),
    { title: "#40 修好微信提醒" },
  );
  assert.deepEqual(parseTodoInlineSyntax("#论文", today, true), { title: "#论文" });
  assert.deepEqual(parseTodoInlineSyntax("!1", today, true), { title: "!1" });

  assert.deepEqual(
    parseTodoInlineSyntax("#工作 !1 @明天 下午评审方案", today, false),
    { title: "#工作 !1 @明天 下午评审方案" },
  );
});

test("getLogicalTodoDate keeps late-night hours on the previous day until dayStartHour", () => {
  assert.equal(getLogicalTodoDate(new Date(2026, 10, 18, 1, 30), 4), "2026-11-17");
  assert.equal(getLogicalTodoDate(new Date(2026, 10, 18, 3, 59), 4), "2026-11-17");
  assert.equal(getLogicalTodoDate(new Date(2026, 10, 18, 4, 0), 4), "2026-11-18");
  assert.equal(getLogicalTodoDate(new Date(2026, 10, 18, 4, 5), 4), "2026-11-18");
  assert.equal(getLogicalTodoDate(new Date(2026, 10, 18, 1, 30), 0), "2026-11-18");
  assert.equal(getLogicalTodoDate(new Date(2026, 0, 1, 2, 15), 4), "2025-12-31");
});

test("sortTodos orders high > medium > low > none stably and supports newest-first", () => {
  const items = [
    { id: "a", title: "普通一", completed: false, createdAt: 10 },
    { id: "b", title: "低优", completed: false, createdAt: 20, priority: "low" },
    { id: "c", title: "高优一", completed: false, createdAt: 30, priority: "high" },
    { id: "d", title: "中优", completed: false, createdAt: 40, priority: "medium" },
    { id: "e", title: "高优二", completed: false, createdAt: 50, priority: "high" },
    { id: "f", title: "普通二", completed: false, createdAt: 60 },
  ];

  assert.deepEqual(sortTodos(items, "manual").map((item) => item.id), ["a", "b", "c", "d", "e", "f"]);
  assert.deepEqual(sortTodos(items, "priority").map((item) => item.id), ["c", "e", "d", "b", "a", "f"]);
  assert.deepEqual(sortTodos(items, "createdDesc").map((item) => item.id), ["f", "e", "d", "c", "b", "a"]);

  assert.deepEqual(insertTodoItem(["a", "b"], "c", "bottom"), ["a", "b", "c"]);
  assert.deepEqual(insertTodoItem(["a", "b"], "c", "top"), ["c", "a", "b"]);
});

test("formatElapsedMinutes, Markdown optional metadata, archive retention and sound fallback work as specified", () => {
  const base = Date.UTC(2026, 10, 18, 9, 0, 0);
  assert.equal(formatElapsedMinutes(base, base + 20_000), "0m");
  assert.equal(formatElapsedMinutes(base, base + 18 * 60_000), "18m");
  assert.equal(formatElapsedMinutes(base, base + 65 * 60_000), "1h 05m");
  assert.equal(todoElapsedLabel(1, base, true), null);
  assert.equal(todoElapsedLabel(base, base + 18 * 60_000, true), "18m");
  assert.equal(todoElapsedLabel(base, base + 18 * 60_000, false), null);

  const todos = [
    { id: "1", title: "写引言", completed: false, createdAt: 1, project: "论文", priority: "high", startedAt: base },
    { id: "2", title: "买咖啡", completed: true, createdAt: 2 },
  ];
  assert.equal(formatTodosAsMarkdown(todos), "- [ ] [论文] 写引言\n- [x] 买咖啡");
  assert.equal(
    formatTodosAsMarkdown(todos, { markdownPriority: true, markdownElapsed: true, now: base + 65 * 60_000 }),
    "- [ ] [论文] [!高] 写引言 (1h 05m)\n- [x] 买咖啡",
  );
  assert.notEqual(
    getTodoSignature("2026-11-18", todos, "", { markdownPriority: true }),
    getTodoSignature("2026-11-18", [{ ...todos[0], priority: "low" }, todos[1]], "", { markdownPriority: true }),
  );

  const archives = [
    { date: "2026-11-18" },
    { date: "2026-08-20" },
    { date: "2026-08-19" },
  ];
  assert.deepEqual(filterArchivesByRetention(archives, "2026-11-18", 0), archives);
  assert.deepEqual(filterArchivesByRetention(archives, "2026-11-18", 90), [
    { date: "2026-11-18" },
    { date: "2026-08-20" },
  ]);

  assert.doesNotThrow(() => playTodoCompleteSound());
});
