import assert from "node:assert/strict";
import { test } from "node:test";
import { createSlots, SlotError } from "@fuyu/plugin-base/client";

const View = () => null;

test("items come out in order, and a list slot shows at most its maximum", () => {
  const slots = createSlots({ "island.page/v1": { max: 2 } });
  slots.add("island.page/v1", { id: "c", order: 3, component: View }, "p");
  slots.add("island.page/v1", { id: "a", order: 1, component: View }, "p");
  slots.add("island.page/v1", { id: "b", order: 2, component: View }, "q");
  assert.deepEqual(slots.items("island.page/v1").map((item) => item.id), ["a", "b"]);
});

test("a single slot shows only the item added last", () => {
  const slots = createSlots({ "island.header/v1": { kind: "single" } });
  slots.add("island.header/v1", { id: "one", component: View }, "p");
  slots.add("island.header/v1", { id: "two", component: View }, "q");
  assert.deepEqual(slots.items("island.header/v1").map((item) => item.id), ["two"]);
});

test("adding to a slot that does not exist fails at once and says which", () => {
  const slots = createSlots({});
  assert.throws(() => slots.add("nowhere/v1", { id: "x", component: View }, "p"), (error) => error instanceof SlotError && error.code === "no-slot" && /nowhere\/v1/.test(error.message));
});

test("one plugin cannot fill a slot past its share", () => {
  const slots = createSlots({ "island.bar/v1": { perPlugin: 2 } });
  slots.add("island.bar/v1", { id: "1", component: View }, "greedy");
  slots.add("island.bar/v1", { id: "2", component: View }, "greedy");
  assert.throws(() => slots.add("island.bar/v1", { id: "3", component: View }, "greedy"), (error) => error.code === "too-many");
  slots.add("island.bar/v1", { id: "3", component: View }, "other");
});

test("registering the same id replaces the item, says whose it replaced, and removing it brings the original back", () => {
  const slots = createSlots({ "island.page/v1": {} });
  const Builtin = () => "builtin";
  const Theirs = () => "theirs";
  slots.add("island.page/v1", { id: "todos", component: Builtin }, "fuyu.todos");
  const remove = slots.add("island.page/v1", { id: "todos", component: Theirs }, "someone.todos");
  const [item] = slots.items("island.page/v1");
  assert.equal(item.component, Theirs);
  assert.equal(item.replaces, "fuyu.todos");
  remove();
  assert.equal(slots.items("island.page/v1")[0].component, Builtin);
});

test("subscribers hear which slot changed, and an unchanged slot keeps the same list", () => {
  const slots = createSlots({ a: {}, b: {} });
  const heard = [];
  slots.subscribe((name) => heard.push(name));
  const before = slots.items("b");
  const remove = slots.add("a", { id: "x", component: View }, "p");
  remove();
  remove();
  assert.deepEqual(heard, ["a", "a"]);
  assert.equal(slots.items("b"), before, "the same array, so React does not re-render b");
});
