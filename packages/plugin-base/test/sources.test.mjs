import assert from "node:assert/strict";
import { join } from "node:path";
import { after, test } from "node:test";
import { startHost } from "@fuyu/plugin-base/host";
import { readBuiltins } from "../src/host/builtins.mjs";
import { until, workspace } from "./workspace.mjs";

const cleanup = [];
after(async () => {
  for (const step of cleanup) await step();
});

function manifest(name, app = {}, extra = {}) {
  const owner = name.split("/")[0].slice(1);
  return JSON.stringify({
    name,
    version: "1.2.0",
    type: "module",
    license: "MIT",
    repository: `github:${owner}/plugin`,
    engines: { fuyu: ">=0.5.0" },
    ...extra,
    fuyu: {
      manifest: 1,
      displayName: { "zh-CN": "示例", en: "Example" },
      description: { "zh-CN": "示例插件", en: "An example plugin" },
      icon: "icon.png",
      categories: ["utilities"],
      ...app,
    },
  });
}

const HOST = (who) => `export const name = ${JSON.stringify(who)};
export function apply(ctx) {
  globalThis.sourceProbe ??= {};
  globalThis.sourceProbe[${JSON.stringify(who)}] = ctx.dataDir;
}
`;

const PROVIDER = `export const name = "provider";
export const inject = ["clients"];
const weatherV1 = { name: "weather/v1", methods: { now: {} }, events: {} };
const extraV1 = { name: "extra/v1", methods: { now: {} }, events: {} };
export function apply(ctx) {
  ctx.services.provide(weatherV1, { now: () => 1 });
  ctx.services.provide(extraV1, { now: () => 2 });
  ctx.clients.add("settings", new URL("../dist/settings.js", import.meta.url).href);
}
`;

function space(files) {
  const made = workspace(files);
  cleanup.push(made.remove);
  return { ...made, data: join(made.dir, "data"), app: join(made.dir, "app") };
}

async function open(made, options = {}) {
  const host = await startHost({ dir: made.data, ...options });
  cleanup.push(() => host.stop());
  await host.settle();
  return host;
}

const byId = (host, id) => host.status().find((entry) => entry.id === id);

test("an installed package loads from plugins-v3/packages/<name>/ by its package.json, with its windows from fuyu.client", async () => {
  const made = space({
    "data/plugins.yml": '- id: "@ann/weather"\n  source: market\n',
    "data/packages/@ann/weather/package.json": manifest("@ann/weather", { host: "dist/host.mjs", client: { island: "dist/island.js" } }),
    "data/packages/@ann/weather/dist/host.mjs": HOST("weather"),
    "data/packages/@ann/weather/dist/island.js": "export default () => {};\n",
  });
  const host = await open(made, { appVersion: "0.6.0" });
  const status = byId(host, "@ann/weather");
  assert.equal(status.state, "running", JSON.stringify(status));
  assert.equal(status.source, "market");
  assert.equal(status.kind, "third-party");
  assert.deepEqual(status.displayName, { "zh-CN": "示例", en: "Example" }, "the status carries the display name, so the island can label a page that has no title");
  assert.equal(globalThis.sourceProbe.weather, join(made.data, "data", "@ann", "weather"));
  assert.deepEqual(host.clients("island").map((entry) => [entry.plugin, entry.path]), [["@ann/weather", "packages/@ann/weather/dist/island.js"]]);
});

test("a package that only has window code runs, and switching it off takes its windows away", async () => {
  const made = space({
    "data/plugins.yml": '- id: "@ann/badge"\n  source: manual\n',
    "data/packages/@ann/badge/package.json": manifest("@ann/badge", { client: { island: "island.js" } }),
    "data/packages/@ann/badge/island.js": "export default () => {};\n",
  });
  const host = await open(made, { watch: true });
  assert.equal(byId(host, "@ann/badge").state, "running");
  assert.equal(host.clients("island").length, 1);
  made.write({ "data/plugins.yml": '- id: "@ann/badge"\n  source: manual\n  disabled: true\n' });
  assert.ok(await until(() => byId(host, "@ann/badge")?.state === "disabled" && host.clients("island").length === 0));
});

test("a market or hand-installed package that uses experimental interfaces fails with the reason; the same code loads from a development folder", async () => {
  const pkg = manifest("@ann/lab", { host: "host.mjs", experimental: ["island.peek"] });
  const made = space({
    "data/plugins.yml": ['- id: "@ann/lab"\n  source: market\n', "- id: lab-dev\n  source: dev\n  path: ../app/lab\n"].join(""),
    "data/packages/@ann/lab/package.json": pkg,
    "data/packages/@ann/lab/host.mjs": HOST("lab"),
    "app/lab/package.json": pkg,
    "app/lab/host.mjs": HOST("lab-dev"),
  });
  const host = await open(made);
  const market = byId(host, "@ann/lab");
  assert.equal(market.state, "failed");
  assert.equal(market.source, "market");
  assert.equal(market.blocked.by, "manifest");
  assert.match(market.reason, /experimental/);
  assert.ok(market.blocked.errors.some((issue) => issue.code === "experimental"));
  assert.equal(globalThis.sourceProbe.lab, undefined);
  const dev = byId(host, "lab-dev");
  assert.equal(dev.state, "running", JSON.stringify(dev));
  assert.equal(dev.source, "dev");
});

test("an installed package fails with a reason when it is missing, misnamed or needs a newer app", async () => {
  const made = space({
    "data/plugins.yml": ['- id: "@ann/gone"\n  source: market\n', '- id: "@ann/alias"\n  source: manual\n', '- id: "@ann/future"\n  source: market\n', "- id: odd\n  source: shelf\n"].join(""),
    "data/packages/@ann/alias/package.json": manifest("@ann/other", { host: "host.mjs" }),
    "data/packages/@ann/alias/host.mjs": HOST("alias"),
    "data/packages/@ann/future/package.json": manifest("@ann/future", { host: "host.mjs" }, { engines: { fuyu: ">=9.0.0" } }),
    "data/packages/@ann/future/host.mjs": HOST("future"),
  });
  const host = await open(made, { appVersion: "0.6.0" });
  const reasons = Object.fromEntries(["@ann/gone", "@ann/alias", "@ann/future", "odd"].map((id) => [id, byId(host, id)]));
  for (const status of Object.values(reasons)) assert.equal(status.state, "failed", JSON.stringify(status));
  assert.match(reasons["@ann/gone"].reason, /not installed/);
  assert.match(reasons["@ann/alias"].reason, /@ann\/other/);
  assert.match(reasons["@ann/future"].reason, /9\.0\.0/);
  assert.match(reasons.odd.reason, /source/);
});

test("a beta app build runs an installed plugin whose engine range is older", async () => {
  const made = space({
    "data/plugins.yml": '- id: "@ann/beta"\n  source: market\n',
    "data/packages/@ann/beta/package.json": manifest("@ann/beta", { host: "host.mjs" }, { engines: { fuyu: ">=0.3.10" } }),
    "data/packages/@ann/beta/host.mjs": HOST("beta"),
  });
  const host = await open(made, { appVersion: "0.3.11-beta.4" });
  const status = byId(host, "@ann/beta");
  assert.equal(status.state, "running", JSON.stringify(status));
});

test("a development folder outside the data folder serves its windows under dev/<id>/", async () => {
  const made = space({
    "data/plugins.yml": "- id: clock\n  source: dev\n  path: ../app/clock\n",
    "app/clock/package.json": manifest("@ann/clock", { host: "host.mjs", client: { island: "dist/island.js" } }),
    "app/clock/host.mjs": `export const name = "clock";\nexport const inject = ["clients"];\nexport function apply(ctx) {\n  ctx.clients.add("island", new URL("./dist/extra.js", import.meta.url).href);\n}\n`,
    "app/clock/dist/island.js": "export default () => {};\n",
    "app/clock/dist/extra.js": "export default () => {};\n",
  });
  const host = await open(made);
  assert.equal(byId(host, "clock").state, "running");
  assert.deepEqual(host.clients("island").map((entry) => entry.path).sort(), ["dev/clock/dist/extra.js", "dev/clock/dist/island.js"]);
});

test("a built-in plugin with a package.json is checked as official and may use experimental interfaces", async () => {
  const made = space({
    "app/builtins.json": JSON.stringify({ format: 1, plugins: [{ id: "pager", root: "pager" }] }),
    "app/pager/package.json": manifest("@fuyu/pager", { host: "host.mjs", experimental: ["island.peek"], provides: ["pager/v1"] }),
    "app/pager/host.mjs": HOST("pager"),
    "data/plugins.yml": "[]\n",
  });
  const host = await open(made, { builtins: made.app });
  const status = byId(host, "pager");
  assert.equal(status.state, "running", JSON.stringify(status));
  assert.equal(status.kind, "builtin");
  assert.equal(status.source, "builtin");
  made.write({ "app/broken/builtins.json": JSON.stringify({ format: 1, plugins: [{ id: "pager", root: "pager" }] }), "app/broken/pager/package.json": manifest("@fuyu/pager", { host: "host.mjs", categories: [] }), "app/broken/pager/host.mjs": HOST("x") });
  assert.throws(() => readBuiltins(join(made.app, "broken")), /package\.json/);
});

test("services and windows a plugin did not declare show up in its status", async () => {
  const made = space({
    "data/plugins.yml": '- id: "@ann/provider"\n  source: market\n- id: loose\n  name: ./loose.mjs\n',
    "data/packages/@ann/provider/package.json": manifest("@ann/provider", { host: "host/index.mjs", provides: ["weather/v1"], client: { island: "dist/island.js" } }),
    "data/packages/@ann/provider/host/index.mjs": PROVIDER,
    "data/packages/@ann/provider/dist/island.js": "export default () => {};\n",
    "data/packages/@ann/provider/dist/settings.js": "export default () => {};\n",
    "data/loose.mjs": PROVIDER.replace(/provider/g, "loose").replace(/weather/g, "breeze").replace(/extra/g, "spare").replace("../dist/settings.js", "./loose.mjs"),
  });
  const host = await open(made);
  const status = byId(host, "@ann/provider");
  assert.equal(status.state, "running", JSON.stringify(status));
  assert.deepEqual(status.undeclared, { provides: ["extra/v1"], client: ["settings"] });
  assert.equal(byId(host, "loose").undeclared, undefined);
  assert.equal(byId(host, "loose").source, "file");
});
