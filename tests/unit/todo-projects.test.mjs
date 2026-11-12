import assert from "node:assert/strict";
import test from "node:test";
import { groupByProject, mapProjects, normalizeTodoProjects, readProject, splitProjectPrefix } from "../../src/features/todos/project.ts";
import { applyProjectEdit, readTodoProjectEdit } from "../../src/features/todos/projectEdits.ts";
import { formatTodosAsMarkdown } from "../../src/features/todos/markdown.ts";
import { parseScheduledTodos, parseTodos } from "../../src/features/todos/normalize.ts";
import { toTodoItems } from "../../src/features/todos/schedule.ts";

test("#name at the start of a todo puts it in a project; a number does not", () => {
  assert.deepEqual(splitProjectPrefix("#论文 写引言"), { title: "写引言", project: "论文" });
  assert.deepEqual(splitProjectPrefix("  #组会   做 PPT "), { title: "做 PPT", project: "组会" });
  assert.deepEqual(splitProjectPrefix("#40 修好微信提醒"), { title: "#40 修好微信提醒" });
  assert.deepEqual(splitProjectPrefix("#论文"), { title: "#论文" });
  assert.deepEqual(splitProjectPrefix("买菜"), { title: "买菜" });
  assert.equal(readProject("  "), undefined);
  assert.equal(readProject("x".repeat(30)), "x".repeat(20));
});

test("todos group by project in the order projects first appear, those without one last", () => {
  const todo = (title, project) => ({ title, ...(project ? { project } : {}) });
  const groups = groupByProject([todo("a", "论文"), todo("b"), todo("c", "组会"), todo("d", "论文")]);
  assert.deepEqual(groups.map((group) => [group.project, group.todos.map((item) => item.title).join("")]), [["论文", "ad"], ["组会", "c"], [null, "b"]]);
  assert.deepEqual(groupByProject([todo("a")]).map((group) => group.project), [null]);
});

test("the project survives reading, the day's arrival and the markdown export; old data reads as before", () => {
  const [kept, old] = parseTodos(JSON.stringify([
    { id: "a", title: "写引言", completed: false, createdAt: 1, project: " 论文 " },
    { id: "b", title: "买菜", completed: true, createdAt: 2 },
  ]));
  assert.equal(kept.project, "论文");
  assert.ok(!("project" in old), "a todo without a project keeps its old shape");
  const [planned] = parseScheduledTodos(JSON.stringify([{ id: "s", title: "跑对比", date: "2026-11-20", createdAt: 0, project: "论文" }]));
  assert.equal(toTodoItems([planned])[0].project, "论文");
  assert.equal(formatTodosAsMarkdown([kept, old]), "- [ ] [论文] 写引言\n- [x] 买菜");
});

test("the saved list follows its order first when grouping, and keeps each id and name once", () => {
  const todo = (title, project) => ({ title, ...(project ? { project } : {}) });
  const groups = groupByProject([todo("a", "论文"), todo("b"), todo("c", "组会")], ["组会", "空项目", "论文"]);
  assert.deepEqual(groups.map((group) => group.project), ["组会", "论文", null]);
  assert.deepEqual(
    normalizeTodoProjects([{ id: "1", name: " 论文 " }, { id: "2", name: "论文" }, { id: "1", name: "组会" }, { id: "", name: "x" }, { id: "3" }, null, { id: "4", name: "组会" }]),
    [{ id: "1", name: "论文" }, { id: "4", name: "组会" }],
  );
  assert.deepEqual(normalizeTodoProjects("论文"), []);
});

test("project edits from the settings page are explicit: rename and remove by id, add and move", () => {
  const projects = [{ id: "1", name: "论文" }, { id: "2", name: "组会" }, { id: "3", name: "杂事" }];
  const newId = () => "new";
  const renamed = applyProjectEdit(projects, { type: "rename", id: "1", name: " 毕业论文 " }, newId);
  assert.deepEqual(renamed?.renamed, { from: "论文", to: "毕业论文" });
  assert.deepEqual(renamed?.projects.map((project) => project.name), ["毕业论文", "组会", "杂事"]);
  assert.equal(applyProjectEdit(projects, { type: "rename", id: "1", name: "组会" }, newId), null, "a taken name is refused");
  const removed = applyProjectEdit(projects, { type: "remove", id: "2" }, newId);
  assert.equal(removed?.removed, "组会");
  assert.deepEqual(removed?.projects.map((project) => project.id), ["1", "3"]);
  assert.equal(applyProjectEdit(projects, { type: "remove", id: "9" }, newId), null, "an unknown id changes nothing");
  assert.deepEqual(applyProjectEdit(projects, { type: "move", id: "3", by: -1 }, newId)?.projects.map((project) => project.id), ["1", "3", "2"]);
  assert.equal(applyProjectEdit(projects, { type: "move", id: "1", by: -1 }, newId), null);
  assert.deepEqual(applyProjectEdit(projects, { type: "add", name: "读书" }, newId)?.projects.at(-1), { id: "new", name: "读书" });
  assert.equal(applyProjectEdit(projects, { type: "add", name: "论文" }, newId), null);
  const full = Array.from({ length: 50 }, (_, index) => ({ id: String(index), name: `p${index}` }));
  assert.equal(applyProjectEdit(full, { type: "add", name: "x" }, newId), null, "no more than 50");

  const todos = [{ id: "a", project: "论文" }, { id: "b", project: "组会" }, { id: "c" }];
  const next = mapProjects(todos, (name) => (name === "组会" ? undefined : name));
  assert.deepEqual(next, [{ id: "a", project: "论文" }, { id: "b" }, { id: "c" }]);
  assert.equal(next[2], todos[2]);
  assert.equal(mapProjects(todos, (name) => name), todos, "nothing changed keeps the same array");
});

test("edit requests are read only when fresh and well formed", () => {
  const now = 1_000_000;
  const request = (edit, requestedAt = now) => JSON.stringify({ edit, requestedAt, nonce: 1 });
  assert.deepEqual(readTodoProjectEdit(request({ type: "remove", id: "2" }), now), { type: "remove", id: "2" });
  assert.equal(readTodoProjectEdit(request({ type: "remove", id: "2" }, now - 6_000), now), null, "stale");
  assert.equal(readTodoProjectEdit(request({ type: "move", id: "2", by: 3 }), now), null);
  assert.equal(readTodoProjectEdit(request({ type: "drop" }), now), null);
  assert.equal(readTodoProjectEdit("{", now), null);
  assert.equal(readTodoProjectEdit(null, now), null);
});
