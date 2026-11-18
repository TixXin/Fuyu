import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createLoader } from "@fuyu/plugin-base/client";
import { SlotItems } from "@fuyu/plugin-base/client/react";
import { BUILTIN, createSlots, SlotError, slotWindow } from "@fuyu/plugin-base/client/slots";
import { SLOTS } from "@fuyu/plugin-base/protocol";

const View = () => null;
const ids = (list) => list.map((item) => item.id);
const failsWith = (code, pattern) => (error) => error instanceof SlotError && error.code === code && (!pattern || pattern.test(error.message));

test("items come out in order, and a list slot shows at most its maximum", () => {
  const slots = createSlots({ "island.page/v1": { max: 2 } });
  slots.add("island.page/v1", { id: "c", order: 3, component: View }, "p");
  slots.add("island.page/v1", { id: "a", order: 1, component: View }, "p");
  slots.add("island.page/v1", { id: "b", order: 2, component: View }, "q");
  assert.deepEqual(ids(slots.items("island.page/v1")), ["a", "b"]);
});

test("items with the same order keep the order they were added in", () => {
  const slots = createSlots({ "island.page/v1": {} });
  for (const id of ["todo", "calendar", "music"]) slots.add("island.page/v1", { id, component: View });
  assert.deepEqual(ids(slots.items("island.page/v1")), ["todo", "calendar", "music"]);
});

test("a single slot shows only the item added last", () => {
  const slots = createSlots({ "island.header/v1": { kind: "single" } });
  slots.add("island.header/v1", { id: "one", component: View }, "p");
  slots.add("island.header/v1", { id: "two", component: View }, "q");
  assert.deepEqual(ids(slots.items("island.header/v1")), ["two"]);
});

test("adding to a slot that does not exist fails at once and says which", () => {
  const slots = createSlots({});
  assert.throws(() => slots.add("nowhere/v1", { id: "x", component: View }, "p"), failsWith("no-slot", /nowhere\/v1/));
  assert.deepEqual(slots.items("nowhere/v1"), []);
});

test("a slot name must end with its version", () => {
  for (const name of ["island.page", "island.page/v0", "Island.page/v1", "island..page/v1", "island.page/v1/x", ""]) {
    assert.throws(() => createSlots({ [name]: {} }), failsWith("bad-name"), name);
  }
  const slots = createSlots({ "island.page/v1": {}, "island.collapsed-center/v12": {} });
  assert.throws(() => slots.define("island.page/next", {}), failsWith("bad-name", /island\.page\/next/));
  assert.deepEqual(slots.names(), ["island.page/v1", "island.collapsed-center/v12"]);
});

test("a rule that cannot work is refused when the slot is defined", () => {
  assert.throws(() => createSlots({ "island.page/v1": { kind: "grid" } }), failsWith("bad-rule"));
  assert.throws(() => createSlots({ "island.page/v1": { kind: "single", groupBy: "category" } }), failsWith("bad-rule"));
  assert.throws(() => createSlots({ "island.page/v1": { perPlugin: 0 } }), failsWith("bad-rule"));
});

test("an item needs an id and a component", () => {
  const slots = createSlots({ "island.page/v1": {} });
  assert.throws(() => slots.add("island.page/v1", { component: View }), failsWith("bad-item", /needs an id/));
  assert.throws(() => slots.add("island.page/v1", { id: "x", component: null }), failsWith("bad-item", /no component/));
  assert.throws(() => slots.add("island.page/v1", { id: "x", component: View }, ""), failsWith("bad-item", /owner/));
});

test("items added without an owner are built in; any other owner is a plugin unless it says otherwise", () => {
  const slots = createSlots({ "island.page/v1": {} });
  slots.add("island.page/v1", { id: "todo", component: View });
  slots.add("island.page/v1", { id: "hello", component: View }, "hello");
  slots.add("island.page/v1", { id: "timer", component: View }, "timer", { external: false });
  assert.deepEqual(
    slots.items("island.page/v1").map(({ id, owner, external }) => [id, owner, external]),
    [["todo", BUILTIN, false], ["hello", "hello", true], ["timer", "timer", false]],
  );
});

test("one plugin cannot fill a slot past its share, and built-in items have no share", () => {
  const slots = createSlots({ "island.bar/v1": { perPlugin: 2 } });
  slots.add("island.bar/v1", { id: "1", component: View }, "greedy");
  slots.add("island.bar/v1", { id: "2", component: View }, "greedy");
  assert.throws(() => slots.add("island.bar/v1", { id: "3", component: View }, "greedy"), failsWith("too-many", /greedy/));
  slots.add("island.bar/v1", { id: "2", order: 5, component: View }, "greedy");
  slots.add("island.bar/v1", { id: "3", component: View }, "other");
  for (const id of ["a", "b", "c", "d"]) slots.add("island.bar/v1", { id, component: View });
  assert.equal(slots.items("island.bar/v1").length, 7);
});

test("metadata comes through untouched, and the registry's own fields cannot be forged", () => {
  const slots = createSlots({ "island.page/v1": {} });
  const enabled = (features) => features.todo === true;
  slots.add("island.page/v1", { id: "todo", component: View, headerDot: true, shortcutOrder: 1, enabled, owner: "someone", external: false, seq: -1, replaces: ["x"] }, "plugin");
  const [item] = slots.items("island.page/v1");
  assert.equal(item.headerDot, true);
  assert.equal(item.shortcutOrder, 1);
  assert.equal(item.enabled, enabled);
  assert.equal(item.owner, "plugin");
  assert.equal(item.external, true);
  assert.ok(item.seq > 0);
  assert.deepEqual(item.replaces, []);
});

test("registering the same id replaces the item, says whose it replaced, and removing it brings the original back", () => {
  const slots = createSlots({ "island.page/v1": {} });
  const Builtin = () => "builtin";
  const Theirs = () => "theirs";
  slots.add("island.page/v1", { id: "todos", component: Builtin });
  const remove = slots.add("island.page/v1", { id: "todos", component: Theirs }, "someone.todos");
  const [item] = slots.items("island.page/v1");
  assert.equal(item.component, Theirs);
  assert.deepEqual(item.replaces, [BUILTIN]);
  remove();
  assert.equal(slots.items("island.page/v1")[0].component, Builtin);
  assert.deepEqual(slots.items("island.page/v1")[0].replaces, []);
});

test("replacements stack: each one can be removed in any order and the right item shows", () => {
  const slots = createSlots({ "island.page/v1": {} });
  const [A, B, C] = [() => "a", () => "b", () => "c"];
  slots.add("island.page/v1", { id: "todos", component: A });
  const removeB = slots.add("island.page/v1", { id: "todos", component: B }, "b");
  const removeC = slots.add("island.page/v1", { id: "todos", component: C }, "c");
  assert.deepEqual(slots.items("island.page/v1")[0].replaces, [BUILTIN, "b"]);
  removeB();
  assert.equal(slots.items("island.page/v1")[0].component, C);
  assert.deepEqual(slots.items("island.page/v1")[0].replaces, [BUILTIN]);
  removeC();
  assert.equal(slots.items("island.page/v1")[0].component, A, "B was already gone, so it does not come back");
  removeB();
  assert.equal(slots.items("island.page/v1").length, 1);
});

test("a replacement keeps the replaced item's place unless it gives its own order", () => {
  const slots = createSlots({ "island.page/v1": {} });
  for (const id of ["todo", "calendar", "music"]) slots.add("island.page/v1", { id, component: View });
  slots.add("island.page/v1", { id: "todo", component: View }, "mine");
  assert.deepEqual(ids(slots.items("island.page/v1")), ["todo", "calendar", "music"]);
  const remove = slots.add("island.page/v1", { id: "calendar", order: 9, component: View }, "theirs");
  assert.deepEqual(ids(slots.items("island.page/v1")), ["todo", "music", "calendar"]);
  remove();
  assert.deepEqual(ids(slots.items("island.page/v1")), ["todo", "calendar", "music"]);
});

test("the same owner adding the same id again swaps its own item, and the old remover does nothing", () => {
  const slots = createSlots({ "island.page/v1": {} });
  const [V1, V2] = [() => "v1", () => "v2"];
  slots.add("island.page/v1", { id: "hello", component: View });
  const removeOld = slots.add("island.page/v1", { id: "hello", component: V1 }, "hello");
  slots.add("island.page/v1", { id: "hello", component: V2 }, "hello");
  removeOld();
  const [item] = slots.items("island.page/v1");
  assert.equal(item.component, V2);
  assert.deepEqual(item.replaces, [BUILTIN]);
});

test("a grouped slot lists each group on its own, counts shares per group, and needs the group field", () => {
  const slots = createSlots({ "settings.section/v1": { groupBy: "category", perPlugin: 1 } });
  slots.add("settings.section/v1", { id: "language", category: "general", component: View });
  slots.add("settings.section/v1", { id: "startup", category: "general", component: View });
  slots.add("settings.section/v1", { id: "tuck", category: "behavior", component: View });
  slots.add("settings.section/v1", { id: "mine", category: "general", component: View }, "plugin");
  slots.add("settings.section/v1", { id: "mine-too", category: "behavior", component: View }, "plugin");
  assert.throws(() => slots.add("settings.section/v1", { id: "more", category: "general", component: View }, "plugin"), failsWith("too-many", /general/));
  assert.throws(() => slots.add("settings.section/v1", { id: "lost", component: View }), failsWith("bad-item", /category/));
  assert.deepEqual(ids(slots.items("settings.section/v1", "general")), ["language", "startup", "mine"]);
  assert.deepEqual(ids(slots.items("settings.section/v1", "behavior")), ["tuck", "mine-too"]);
  assert.equal(slots.items("settings.section/v1").length, 5);
  const behavior = slots.items("settings.section/v1", "behavior");
  const remove = slots.add("settings.section/v1", { id: "theme", category: "general", component: View });
  assert.equal(slots.items("settings.section/v1", "behavior"), behavior, "another group keeps the same array");
  remove();
});

test("subscribers hear which slot changed, and an unchanged slot keeps the same list", () => {
  const slots = createSlots({ "a/v1": {}, "b/v1": {} });
  const heard = [];
  slots.subscribe((name) => heard.push(name));
  const before = slots.items("b/v1");
  const remove = slots.add("a/v1", { id: "x", component: View }, "p");
  remove();
  remove();
  assert.deepEqual(heard, ["a/v1", "a/v1"]);
  assert.equal(slots.items("b/v1"), before, "the same array, so React does not re-render b");
});

test("a plugin loaded from the host is always a plugin item, whatever its item says", async () => {
  const slots = createSlots({ "island.dev/v1": {} });
  const loader = createLoader({
    registry: slots,
    base: "fuyu-plugin://localhost",
    checkFile: async () => {},
    importModule: async () => ({ default: (ctx) => ctx.slots.add("island.dev/v1", { id: "hello", component: View, external: false }) }),
  });
  await loader.sync([{ id: "hello#1", plugin: "hello", window: "island", path: "hello/island.js", version: "1" }]);
  assert.deepEqual(slots.items("island.dev/v1").map(({ owner, external }) => [owner, external]), [["hello", true]]);
  await loader.stop();
});

test("every published slot has a valid name, a window, a share and its metadata fields", () => {
  const registry = createSlots(SLOTS);
  assert.deepEqual(registry.names().sort(), Object.keys(SLOTS).sort());
  for (const [name, rule] of Object.entries(SLOTS)) {
    assert.ok(["island", "settings", "plugin-window"].includes(slotWindow(name)), name);
    assert.ok(Number.isInteger(rule.perPlugin) && rule.perPlugin >= 1, name);
    assert.ok(Array.isArray(rule.meta), name);
    if (rule.groupBy) assert.ok(rule.meta.includes(rule.groupBy), `${name} lists its group field`);
  }
  assert.deepEqual(SLOTS["island.dev/v1"], { kind: "list", max: 3, perPlugin: 1, meta: [] });
  assert.equal(SLOTS["island.collapsed-center/v1"].kind, "single");
  assert.equal(slotWindow("not a slot"), null);
  assert.equal(JSON.stringify(JSON.parse(JSON.stringify(SLOTS))), JSON.stringify(SLOTS), "plain data");
});

test("the slot registry imports nothing, so a window can build it without loading the kernel", () => {
  const source = readFileSync(new URL("../src/client/slots.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /^\s*import\b|\bimport\(/m);
});

const markup = (slots, name, extra = {}) =>
  renderToStaticMarkup(
    createElement(SlotItems, {
      registry: slots,
      name,
      wrap: (item, node) => (item.external ? createElement("div", { className: "plugin-slot", "data-slot": name }, node) : node),
      ...extra,
    }),
  );

test("built-in items render flat and plugin items get the themed wrapper, each with the props", () => {
  const slots = createSlots({ "island.page/v1": {} });
  slots.add("island.page/v1", { id: "a", component: ({ label }) => createElement("p", null, `a ${label}`) });
  slots.add("island.page/v1", { id: "b", component: ({ label }) => createElement("p", null, `b ${label}`) }, "hello");
  assert.equal(markup(slots, "island.page/v1", { props: { label: "x" } }), '<p>a x</p><div class="plugin-slot" data-slot="island.page/v1"><p>b x</p></div>');
  assert.equal(markup(slots, "island.page/v1", { props: { label: "x" }, select: (items) => items.filter((item) => item.id === "a") }), "<p>a x</p>");
});

test("a grouped slot renders only the asked group", () => {
  const slots = createSlots({ "settings.section/v1": { groupBy: "category" } });
  slots.add("settings.section/v1", { id: "one", category: "general", component: () => createElement("i", null, "one") });
  slots.add("settings.section/v1", { id: "two", category: "behavior", component: () => createElement("i", null, "two") });
  assert.equal(markup(slots, "settings.section/v1", { group: "behavior" }), "<i>two</i>");
});

test("an item that fails is reported with its slot and owner, and only that item goes", () => {
  const slots = createSlots({ "island.page/v1": {} });
  const boom = new Error("boom");
  slots.add("island.page/v1", { id: "ok", component: () => "fine" });
  slots.add("island.page/v1", { id: "bad", component: View }, "hello");
  let elements = [];
  const Probe = () => {
    elements = SlotItems({ registry: slots, name: "island.page/v1" });
    return null;
  };
  renderToStaticMarkup(createElement(Probe));
  const failures = [];
  const boundary = elements[1];
  const instance = new boundary.type({ ...boundary.props, onError: (failure) => failures.push(failure) });
  instance.state = boundary.type.getDerivedStateFromError(boom);
  instance.componentDidCatch(boom);
  assert.equal(instance.render(), null);
  assert.deepEqual(failures, [{ slot: "island.page/v1", id: "bad", owner: "hello", external: true, error: boom }]);
  assert.equal(elements[0].key, `${BUILTIN}:ok:${slots.items("island.page/v1")[0].seq}`);
});

test("items of a switched-off owner drop out of every view and come back when it is switched on", () => {
  const slots = createSlots({ "island.page/v1": {}, "settings.section/v1": { groupBy: "category" } });
  slots.add("island.page/v1", { id: "timer", order: 1, component: View }, "timer", { external: false });
  slots.add("island.page/v1", { id: "todo", order: 2, component: View }, "todos", { external: false });
  slots.add("settings.section/v1", { id: "sound", category: "timer", component: View }, "timer", { external: false });
  const seen = [];
  slots.subscribe((name) => seen.push(name));
  slots.setDisabledOwners(["timer"]);
  assert.deepEqual(ids(slots.items("island.page/v1")), ["todo"]);
  assert.deepEqual(slots.items("settings.section/v1", "timer"), []);
  assert.deepEqual(slots.disabledOwners(), ["timer"]);
  assert.deepEqual(seen.sort(), ["island.page/v1", "settings.section/v1"]);
  slots.setDisabledOwners(new Set(["timer"]));
  assert.equal(seen.length, 2, "the same set again changes nothing");
  slots.add("island.page/v1", { id: "late", component: View }, "timer", { external: false });
  assert.deepEqual(ids(slots.items("island.page/v1")), ["todo"], "items added while the owner is off stay hidden");
  slots.setDisabledOwners([]);
  assert.deepEqual(ids(slots.items("island.page/v1")), ["late", "timer", "todo"]);
  assert.equal(slots.items("settings.section/v1", "timer").length, 1);
});

test("switching off the owner of a replacement shows the item it replaced", () => {
  const slots = createSlots({ "island.page/v1": {} });
  slots.add("island.page/v1", { id: "music", component: View });
  slots.add("island.page/v1", { id: "music", component: View, label: "theirs" }, "player");
  slots.setDisabledOwners(["player"]);
  const [item] = slots.items("island.page/v1");
  assert.equal(item.owner, BUILTIN);
  assert.equal(item.label, undefined);
  assert.deepEqual(item.replaces, []);
});
