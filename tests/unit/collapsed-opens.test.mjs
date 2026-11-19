import assert from "node:assert/strict";
import test from "node:test";
import { SLOTS } from "../../packages/plugin-base/src/protocol.mjs";
import { collapsedOpensTarget } from "../../src/windows/island/collapsedOpens.ts";

const pages = [
  { id: "world-clock", owner: "@test/world-clock" },
  { id: "@test/system-monitor", owner: "@test/system-monitor" },
  { id: "todo", owner: "todo" },
];
const item = (opens, owner = "@test/world-clock") => ({ id: "bar", owner, opens });

test("island.collapsed/v1 lists opens among its metadata", () => {
  assert.ok(SLOTS["island.collapsed/v1"].meta.includes("opens"));
});

test("an item without opens opens nothing and warns about nothing", () => {
  assert.deepEqual(collapsedOpensTarget({ id: "bar", owner: "@test/world-clock" }, pages), { page: null, warning: null });
});

test("an item opens a page its own plugin registered", () => {
  assert.deepEqual(collapsedOpensTarget(item("world-clock"), pages), { page: "world-clock", warning: null });
  assert.deepEqual(collapsedOpensTarget(item("@test/system-monitor", "@test/system-monitor"), pages), { page: "@test/system-monitor", warning: null });
});

test("an item that points at another plugin's page is ignored with a warning naming the owner", () => {
  const { page, warning } = collapsedOpensTarget(item("@test/system-monitor"), pages);
  assert.equal(page, null);
  assert.match(warning, /bar from @test\/world-clock opens @test\/system-monitor, which belongs to @test\/system-monitor/);
});

test("an item that points at a built-in page is ignored with a warning", () => {
  const { page, warning } = collapsedOpensTarget(item("todo"), pages);
  assert.equal(page, null);
  assert.match(warning, /opens todo, which belongs to todo/);
});

test("an item that points at a page nobody registered is ignored with a warning", () => {
  const { page, warning } = collapsedOpensTarget(item("missing"), pages);
  assert.equal(page, null);
  assert.match(warning, /opens missing, and that plugin has no island.page\/v1 with that id/);
});

test("an opens that is not a page id is ignored with a warning", () => {
  for (const opens of ["", 3, null, { id: "world-clock" }]) {
    const { page, warning } = collapsedOpensTarget(item(opens), pages);
    assert.equal(page, null);
    assert.match(warning, /not a page id/);
  }
});
