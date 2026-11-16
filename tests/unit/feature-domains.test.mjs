import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { classDomains, ipcDomains, namesOf } from "../../src/features/plugin-kernel/featureDomains.ts";
import { installIpcLedger } from "../../src/features/plugin-kernel/ipcLedger.ts";

const SRC = fileURLToPath(new URL("../../src/", import.meta.url));
const catalog = JSON.parse(readFileSync(join(SRC, "features", "builtins.json"), "utf8"));

function apiSources(dir = SRC, found = {}) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) apiSources(path, found);
    else if (entry.name === "api.ts") found[`/src/${relative(SRC, path).replaceAll("\\", "/")}`] = readFileSync(path, "utf8");
  }
  return found;
}

test("commands and events go to the built-in plugin whose api.ts alone names them", () => {
  const domains = ipcDomains(apiSources(), catalog.plugins);
  const translation = namesOf(domains, "translation");
  assert.ok(translation.commands.includes("translate_text") && translation.commands.includes("set_translation_shortcut"), translation.commands.join(", "));
  assert.ok(translation.events.length >= 3, translation.events.join(", "));
  assert.ok(!domains.commands.has("is_session_locked") && !domains.events.has("foreground-fullscreen-changed"), "the timer shares these with the island and the agent push");
});

test("a name that two places use belongs to neither", () => {
  const domains = ipcDomains({
    "/src/features/a/api.ts": 'const E = "shared-event";\ninvoke<string>("only_a");\ninvoke("both");\nlisten<number>(E, h);\nlisten("a-event", h);',
    "/src/features/b/api.ts": 'invoke("both");\nlisten(E, h);',
    "/src/windows/island/api.ts": 'invoke("a_too");',
    "/src/features/a/more/api.ts": 'invoke("a_too");',
  }, [{ id: "plug-a", root: "a" }, { id: "plug-b", root: "b" }]);
  assert.deepEqual(namesOf(domains, "plug-a"), { commands: ["only_a"], events: ["a-event"] });
  assert.deepEqual(namesOf(domains, "plug-b"), { commands: [], events: [] });
});

test("the ledger counts commands and the listeners still alive", async () => {
  let next = 0;
  const internals = { invoke: async (command, args) => (command === "plugin:event|listen" ? ++next : args ?? null) };
  const ledger = installIpcLedger(internals);
  assert.equal(ledger.recording, true);
  await internals.invoke("translate_text", { text: "a" });
  await internals.invoke("translate_text");
  const first = await internals.invoke("plugin:event|listen", { event: "x", handler: 1 });
  await internals.invoke("plugin:event|listen", { event: "x", handler: 2 });
  await internals.invoke("plugin:event|unlisten", { event: "x", eventId: first });
  assert.equal(ledger.calls("translate_text"), 2);
  assert.equal(ledger.calls("plugin:event|listen"), 0);
  assert.equal(ledger.listening("x"), 1);
  assert.deepEqual(ledger.snapshot(), { calls: { translate_text: 2 }, listening: { x: 1 } });
  ledger.stop();
  await internals.invoke("translate_text");
  assert.equal(ledger.calls("translate_text"), 2);
});

test("a read-only invoke, as in the Mac webview, leaves the window running and the ledger empty", async () => {
  const internals = {};
  const invoke = async (command) => command;
  Object.defineProperty(internals, "invoke", { value: invoke, writable: false, configurable: false, enumerable: true });
  const ledger = installIpcLedger(internals);
  assert.equal(ledger.recording, false);
  assert.equal(internals.invoke, invoke);
  assert.equal(await internals.invoke("translate_text"), "translate_text");
  assert.equal(ledger.calls("translate_text"), 0);
  assert.deepEqual(ledger.snapshot(), { calls: {}, listening: {} });
  assert.doesNotThrow(() => ledger.stop());
  assert.equal(internals.invoke, invoke);
});

test("a configurable but read-only invoke is swapped in place and put back on stop", async () => {
  const internals = {};
  const invoke = async (command) => command;
  Object.defineProperty(internals, "invoke", { value: invoke, writable: false, configurable: true, enumerable: false });
  const ledger = installIpcLedger(internals);
  assert.equal(ledger.recording, true);
  assert.notEqual(internals.invoke, invoke);
  await internals.invoke("translate_text");
  assert.equal(ledger.calls("translate_text"), 1);
  ledger.stop();
  assert.equal(internals.invoke, invoke);
  assert.deepEqual(Object.getOwnPropertyDescriptor(internals, "invoke"), { value: invoke, writable: false, configurable: true, enumerable: false });
});

test("a class belongs to the built-in plugin whose CSS alone defines it", () => {
  const classes = classDomains({
    "/src/features/timer/TimerChip.css": ".timer-chip { color: red; }\n.timer-chip__dot:hover, .shared { margin: .5rem; background: url(./a.png); }\n/* .commented */",
    "/src/components/list.css": ".shared { }",
    "/src/features/media/x.css": ".media-wave { }",
  }, [{ id: "timer", root: "timer" }, { id: "music", root: "media" }]);
  assert.deepEqual([...classes].sort(), [["media-wave", "music"], ["timer-chip", "timer"], ["timer-chip__dot", "timer"]]);
});
