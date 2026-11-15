import assert from "node:assert/strict";
import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { after, test } from "node:test";
import { startHost } from "@fuyu/plugin-base/host";
import { dataDirOf } from "../src/host/data.mjs";
import { readBuiltins, withBuiltins } from "../src/host/builtins.mjs";
import { config, until, workspace } from "./workspace.mjs";

const cleanup = [];
after(async () => {
  for (const step of cleanup) await step();
});

const KEEPER = `export const name = "keeper";
export const inject = ["clients"];
const keeperV1 = { name: "keeper/v1", methods: { ping: {} }, events: {} };
export function apply(ctx, config) {
  globalThis.keeperProbe = { config, dataDir: ctx.dataDir };
  ctx.services.provide(keeperV1, { ping: () => "pong" });
  ctx.setInterval(() => {}, 1000);
  ctx.setTimeout(() => {}, 60000);
  ctx.on("probe/keeper", () => {});
  ctx.clients.add("island", new URL("../ui/island.js", import.meta.url).href);
}
`;

const PLAIN = (id) => `export const name = ${JSON.stringify(id)};\nexport function apply(ctx) {\n  globalThis.plainProbe ??= {};\n  globalThis.plainProbe[${JSON.stringify(id)}] = ctx.dataDir;\n}\n`;

const CATALOG = {
  format: 1,
  plugins: [
    { id: "keeper", kind: "builtin", root: "keeper", host: "host/index.mjs" },
    { id: "core", kind: "essential", root: "core", host: "index.mjs" },
  ],
};

function space(pluginsYml, catalog = CATALOG) {
  const files = {
    "app/builtins.json": JSON.stringify(catalog),
    "app/keeper/host/index.mjs": KEEPER,
    "app/keeper/ui/island.js": "export default () => {};\n",
    "app/core/index.mjs": PLAIN("core"),
    "data/plugins.yml": pluginsYml,
    "data/mine.mjs": PLAIN("mine"),
  };
  const made = workspace(files);
  cleanup.push(made.remove);
  return { ...made, app: join(made.dir, "app"), data: join(made.dir, "data") };
}

async function open(made, options = {}) {
  const host = await startHost({ dir: made.data, builtins: made.app, ...options });
  cleanup.push(() => host.stop());
  await host.settle();
  return host;
}

const byId = (host, id) => host.status().find((entry) => entry.id === id);

test("built-in plugins run without an entry in plugins.yml, with the kind the app's list gives them", async () => {
  const host = await open(space(config([{ id: "mine", name: "./mine.mjs" }])));
  assert.deepEqual(
    host.status().map((entry) => [entry.id, entry.state, entry.kind]),
    [
      ["keeper", "running", "builtin"],
      ["core", "running", "essential"],
      ["mine", "running", "third-party"],
    ],
  );
  assert.deepEqual(host.builtins(), [
    { id: "keeper", kind: "builtin" },
    { id: "core", kind: "essential" },
  ]);
  assert.deepEqual(host.services().map((service) => [service.name, service.plugin]), [["keeper/v1", "keeper"]]);
});

test("entries in plugins.yml cannot make a plugin built-in or swap a built-in's code", async () => {
  const yml = ["- id: mine\n  name: ./mine.mjs\n  kind: builtin\n", "- id: core\n  name: ./mine.mjs\n  kind: third-party\n"].join("");
  const made = space(yml);
  const host = await open(made, { safe: "third-party" });
  assert.equal(byId(host, "mine").kind, "third-party");
  assert.equal(byId(host, "mine").state, "safe-mode");
  assert.equal(byId(host, "core").kind, "essential");
  assert.equal(byId(host, "core").state, "running");
  assert.equal(byId(host, "core").name, pathToFileURL(join(realpathSync(made.app), "core", "index.mjs")).href);
  assert.equal(globalThis.plainProbe.core, join(made.data, "data", "core"));
});

test("plugins.yml switches a built-in plugin off, and everything it set up goes with it", async () => {
  const made = space("[]\n");
  const host = await open(made, { watch: true });
  const keeper = byId(host, "keeper");
  assert.deepEqual(
    [keeper.usage.services, keeper.usage.timers, keeper.usage.listeners, keeper.usage.clients],
    [1, 2, 1, 1],
  );
  assert.deepEqual(host.clients().map((client) => client.path), ["builtin/keeper/ui/island.js"]);
  made.write({ "data/plugins.yml": "- id: keeper\n  disabled: true\n" });
  assert.ok(await until(() => byId(host, "keeper").state === "disabled"), "the built-in plugin did not stop");
  assert.deepEqual(host.services(), []);
  assert.deepEqual(host.clients(), []);
  assert.equal(host.timers().keeper, undefined);
  assert.equal(Object.keys(host.ctx.events._hooks).filter((name) => name === "probe/keeper").flatMap((name) => host.ctx.events._hooks[name]).length, 0);
  made.write({ "data/plugins.yml": "- id: keeper\n  config:\n    greeting: hi\n" });
  assert.ok(await until(() => byId(host, "keeper")?.state === "running" && globalThis.keeperProbe.config?.greeting === "hi"));
  assert.equal(globalThis.keeperProbe.dataDir, join(made.data, "data", "keeper"));
  assert.equal(host.services().length, 1);
});

test("a leftover switch for a built-in plugin the app no longer has is ignored", async () => {
  const host = await open(space("- id: gone\n  disabled: true\n"));
  assert.equal(byId(host, "gone"), undefined);
  assert.ok(host.logs.some((entry) => /no built-in plugin has that id/.test(entry.text)));
});

test("without a built-in list every plugin is third-party, whatever plugins.yml says", async () => {
  const made = space("- id: mine\n  name: ./mine.mjs\n  kind: essential\n");
  const host = await startHost({ dir: made.data, safe: "minimal" });
  cleanup.push(() => host.stop());
  await host.settle();
  assert.equal(byId(host, "mine").kind, "third-party");
  assert.equal(byId(host, "mine").state, "safe-mode");
});

test("each plugin's data folder is data/<id> next to plugins.yml, and ids that cannot name a folder are refused", () => {
  assert.equal(dataDirOf("/d", "timer"), join("/d", "timer"));
  assert.equal(dataDirOf("/d", "@someone/weather"), join("/d", "@someone", "weather"));
  for (const bad of ["../up", "a/b", "@a/b/c", "..", ".hidden", "trailing.", "", "a\\b", "c:d", null]) {
    assert.throws(() => dataDirOf("/d", bad), /cannot name a data folder/, String(bad));
  }
});

test("the built-in list is checked: format, duplicate ids, paths that leave the folder, missing files", () => {
  const cases = [
    [{ plugins: [] }, /must be \{ "format": 1/],
    [{ format: 1, plugins: [{ id: "Bad", root: "keeper", host: "host/index.mjs" }] }, /id must be lowercase/],
    [{ format: 1, plugins: [CATALOG.plugins[0], CATALOG.plugins[0]] }, /listed twice/],
    [{ format: 1, plugins: [{ id: "x", kind: "third-party", root: "keeper", host: "host/index.mjs" }] }, /kind must be/],
    [{ format: 1, plugins: [{ id: "x", root: "keeper", host: "../core/index.mjs" }] }, /relative paths/],
    [{ format: 1, plugins: [{ id: "x", root: "keeper", host: "host/missing.mjs" }] }, /is missing/],
  ];
  for (const [catalog, error] of cases) {
    const made = space("[]\n", catalog);
    assert.throws(() => readBuiltins(made.app), error, JSON.stringify(catalog));
  }
  const made = space("[]\n");
  mkdirSync(join(made.app, "empty"));
  writeFileSync(join(made.app, "builtins.json"), JSON.stringify({ format: 1, plugins: [{ id: "x", root: "empty", host: "index.mjs" }] }));
  assert.throws(() => readBuiltins(made.app), /is missing/);
});

test("merging keeps only the switch and config of a built-in's entry, and strips kind from the rest, groups included", () => {
  const builtins = [{ id: "timer", name: "file:///app/timer.mjs", kind: "builtin" }];
  const warnings = [];
  const merged = withBuiltins(
    [
      { id: "other", name: "./other.mjs", kind: "essential", config: { a: 1 } },
      { id: "timer", name: "./evil.mjs", kind: "third-party", disabled: true, config: { b: 2 }, inject: ["x"] },
      { id: "box", name: "group", group: true, kind: "builtin", config: [{ id: "boxed", name: "./b.mjs", kind: "builtin" }, { id: "timer", name: "./c.mjs" }] },
    ],
    builtins,
    (text) => warnings.push(text),
  );
  assert.deepEqual(merged, [
    { id: "timer", name: "file:///app/timer.mjs", kind: "builtin", disabled: true, config: { b: 2 } },
    { id: "other", name: "./other.mjs", config: { a: 1 } },
    { id: "box", name: "group", group: true, config: [{ id: "boxed", name: "./b.mjs" }] },
  ]);
  assert.match(warnings.join("\n"), /timer inside a group has the id of a built-in plugin/);
});
