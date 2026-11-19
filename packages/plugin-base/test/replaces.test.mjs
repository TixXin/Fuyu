import assert from "node:assert/strict";
import { join } from "node:path";
import { after, test } from "node:test";
import { startHost } from "@fuyu/plugin-base/host";
import { builtinEntries, withBuiltins } from "../src/host/builtins.mjs";
import { SOURCE } from "../src/host/sources.mjs";
import { until, workspace } from "./workspace.mjs";

const cleanup = [];
after(async () => {
  for (const step of cleanup) await step();
});

const provider = (id, service, answer, extra = "") => `export const name = ${JSON.stringify(id)};
const definition = { name: ${JSON.stringify(service)}, methods: { ping: {} }, events: {} };
export function apply(ctx) {
  ctx.services.provide(definition, { ping: () => ${JSON.stringify(answer)} });
  ${extra}
}
`;

const CATALOG = {
  format: 1,
  plugins: [
    { id: "keeper", kind: "builtin", root: "keeper", host: "index.mjs", provides: ["keeper/v1"] },
    { id: "core", kind: "essential", root: "core", host: "index.mjs", provides: ["core/v1"] },
  ],
};

const replacer = (file, service = "keeper/v1", more = "") => `- id: mine\n  name: ./${file}\n  replaces:\n    - ${service}\n${more}`;

function space(pluginsYml) {
  const made = workspace({
    "app/builtins.json": JSON.stringify(CATALOG),
    "app/keeper/index.mjs": provider("keeper", "keeper/v1", "builtin"),
    "app/core/index.mjs": provider("core", "core/v1", "essential"),
    "data/plugins.yml": pluginsYml,
    "data/replacer.mjs": provider("replacer", "keeper/v1", "replaced"),
    "data/broken.mjs": provider("broken", "keeper/v1", "broken", 'throw new Error("broken after providing");'),
    "data/grabber.mjs": provider("grabber", "core/v1", "grabbed"),
  });
  cleanup.push(made.remove);
  return { ...made, app: join(made.dir, "app"), data: join(made.dir, "data") };
}

async function open(made, options = {}) {
  const host = await startHost({ dir: made.data, builtins: made.app, ...options });
  cleanup.push(() => host.stop());
  await host.settle();
  return host;
}

const holder = (host, name) => host.services().find((service) => service.name === name)?.plugin ?? null;
const ping = (host, name) => host.serviceHub.invoke(name, "ping", {}, { plugin: "test" });
const byId = (host, id) => host.status().find((entry) => entry.id === id);

test("a running plugin that replaces a built-in service takes it, and the built-in takes it back when the plugin is switched off", async () => {
  const made = space(replacer("replacer.mjs"));
  const host = await open(made, { watch: true });
  assert.equal(holder(host, "keeper/v1"), "mine");
  assert.equal(await ping(host, "keeper/v1"), "replaced");
  assert.equal(byId(host, "keeper").state, "running");
  assert.deepEqual(byId(host, "keeper").replacedServices, [{ service: "keeper/v1", by: "mine" }]);
  assert.deepEqual(byId(host, "keeper").disabledServices, ["keeper/v1"]);

  made.write({ "data/plugins.yml": replacer("replacer.mjs", "keeper/v1", "  disabled: true\n") });
  assert.ok(await until(() => holder(host, "keeper/v1") === "keeper"), "the built-in did not take its service back");
  assert.equal(await ping(host, "keeper/v1"), "builtin");
  assert.equal(byId(host, "keeper").replacedServices, undefined);
  assert.equal(byId(host, "keeper").disabledServices, undefined);

  made.write({ "data/plugins.yml": replacer("replacer.mjs") });
  assert.ok(await until(() => holder(host, "keeper/v1") === "mine"), "the plugin did not take the service again");
});

test("a replacement held back by the bisect or by safe mode leaves the built-in service on", async () => {
  const host = await open(space(replacer("replacer.mjs")));
  host.bisect(["mine"]);
  assert.ok(await until(() => holder(host, "keeper/v1") === "keeper"), "the bisect did not hand the service back");
  assert.equal(await ping(host, "keeper/v1"), "builtin");
  host.bisect([]);
  assert.ok(await until(() => holder(host, "keeper/v1") === "mine"), "the plugin did not come back after the bisect");

  const safe = await open(space(replacer("replacer.mjs")), { safe: "third-party" });
  assert.equal(byId(safe, "mine").state, "safe-mode");
  assert.equal(holder(safe, "keeper/v1"), "keeper");
  assert.equal(await ping(safe, "keeper/v1"), "builtin");
});

test("a replacement that fails to start leaves the built-in service on", async () => {
  const host = await open(space(replacer("broken.mjs")));
  assert.notEqual(byId(host, "mine").state, "running");
  assert.equal(holder(host, "keeper/v1"), "keeper");
  assert.equal(await ping(host, "keeper/v1"), "builtin");
});

test("a built-in that restarts while its service is replaced waits, and takes the service when the replacement stops", async () => {
  const made = space(replacer("replacer.mjs"));
  const host = await open(made, { watch: true });
  made.write({ "data/plugins.yml": `- id: keeper\n  config:\n    again: true\n${replacer("replacer.mjs")}` });
  assert.ok(await until(() => byId(host, "keeper")?.state === "running"));
  await host.settle();
  assert.equal(holder(host, "keeper/v1"), "mine");
  made.write({ "data/plugins.yml": `- id: keeper\n  config:\n    again: true\n${replacer("replacer.mjs", "keeper/v1", "  disabled: true\n")}` });
  assert.ok(await until(() => holder(host, "keeper/v1") === "keeper"), "the restarted built-in did not take its service back");
});

test("a third-party plugin cannot replace a service an essential built-in provides", async () => {
  const host = await open(space(replacer("grabber.mjs", "core/v1")));
  assert.equal(holder(host, "core/v1"), "core");
  assert.equal(await ping(host, "core/v1"), "essential");
  assert.notEqual(byId(host, "mine").state, "running");
  assert.ok(host.logs.some((entry) => /cannot replace core\/v1, which the app itself needs/.test(entry.text)));
  assert.ok(host.logs.some((entry) => /core\/v1 is provided by the app itself/.test(entry.text)));

  const warnings = [];
  const builtins = builtinEntries([{ id: "updater", kind: "essential", root: "/app/updater", host: "file:///app/updater/index.mjs", provides: ["market/v1"] }]);
  const [, mine] = withBuiltins([{ id: "mine", name: "./mine.mjs", replaces: ["market/v1", "lyrics/v1"] }], builtins, (text) => warnings.push(text));
  assert.deepEqual(mine.replaces, ["lyrics/v1"]);
  assert.equal(warnings.length, 1);
  assert.equal(builtins[0][SOURCE].provides[0], "market/v1");
});
