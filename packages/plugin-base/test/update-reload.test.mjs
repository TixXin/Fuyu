import assert from "node:assert/strict";
import { join } from "node:path";
import { after, test } from "node:test";
import { startHost } from "@fuyu/plugin-base/host";
import { until, workspace } from "./workspace.mjs";

const cleanup = [];
after(async () => {
  for (const step of cleanup) await step();
});

function manifest(name, version, extra = {}) {
  return JSON.stringify({
    name,
    version,
    type: "module",
    license: "MIT",
    repository: "github:ann/plugin",
    engines: { fuyu: ">=0.5.0" },
    fuyu: {
      manifest: 1,
      displayName: { "zh-CN": "示例", en: "Example" },
      description: { "zh-CN": "示例插件", en: "An example plugin" },
      icon: "icon.png",
      categories: ["utilities"],
      host: "dist/host.mjs",
      ...extra,
    },
  });
}

const HOST = (who) => `import { answer } from "./answer.mjs";
export const name = ${JSON.stringify(who)};
export function apply(ctx) {
  globalThis.updateProbe ??= {};
  globalThis.updateProbe[${JSON.stringify(who)}] = { answer, live: true };
  ctx.effect(() => () => { globalThis.updateProbe[${JSON.stringify(who)}].live = false; });
}
`;

const ANSWER = (value) => `export const answer = ${JSON.stringify(value)};\n`;

function pkg(id, version, answer) {
  const dir = `data/packages/${id}`;
  return {
    [`${dir}/package.json`]: manifest(id, version),
    [`${dir}/dist/host.mjs`]: HOST(id),
    [`${dir}/dist/answer.mjs`]: ANSWER(answer),
  };
}

async function refresh(host) {
  for (const entry of host.ctx.loader.entries()) {
    if (typeof entry?.subtree?.reapply === "function") await entry.subtree.reapply();
  }
  await host.settle();
}

test("updating an installed plugin runs the new host code without restarting the host or the other plugins", async () => {
  const made = workspace({
    "data/plugins.yml": '- id: "@ann/weather"\n  source: market\n- id: "@ann/clock"\n  source: market\n',
    ...pkg("@ann/weather", "1.0.0", "v1"),
    ...pkg("@ann/clock", "1.0.0", "clock"),
  });
  cleanup.push(made.remove);
  const host = await startHost({ dir: join(made.dir, "data"), appVersion: "0.6.0" });
  cleanup.push(() => host.stop());
  await host.settle();
  assert.equal(globalThis.updateProbe["@ann/weather"].answer, "v1");
  const clock = globalThis.updateProbe["@ann/clock"];
  const first = globalThis.updateProbe["@ann/weather"];

  await refresh(host);
  assert.equal(globalThis.updateProbe["@ann/weather"], first, "re-reading an unchanged folder keeps the running instance");

  made.write(pkg("@ann/weather", "2.0.0", "v2"));
  await refresh(host);

  assert.equal(globalThis.updateProbe["@ann/weather"].answer, "v2");
  assert.equal(first.live, false);
  assert.equal(globalThis.updateProbe["@ann/clock"], clock);
  assert.equal(clock.live, true);
});

const KEEPER = `export const name = "keeper";
const definition = { name: "keeper/v1", methods: { ping: {} }, events: {} };
export function apply(ctx) {
  ctx.services.provide(definition, { ping: () => "builtin" });
}
`;

const REPLACER = `import { answer } from "./answer.mjs";
export const name = "replacer";
const definition = { name: "keeper/v1", methods: { ping: {} }, events: {} };
export function apply(ctx) {
  ctx.services.provide(definition, { ping: () => answer });
}
`;

function replacer(version, answer) {
  const dir = "data/packages/@ann/keeper";
  return {
    [`${dir}/package.json`]: manifest("@ann/keeper", version, { replaces: ["keeper/v1"] }),
    [`${dir}/dist/host.mjs`]: REPLACER,
    [`${dir}/dist/answer.mjs`]: ANSWER(answer),
  };
}

test("updating a plugin that replaces a built-in service hands the service straight to the new version and no call goes unanswered", async () => {
  const made = workspace({
    "app/builtins.json": JSON.stringify({ format: 1, plugins: [{ id: "keeper", kind: "builtin", root: "keeper", host: "index.mjs", provides: ["keeper/v1"] }] }),
    "app/keeper/index.mjs": KEEPER,
    "data/plugins.yml": '- id: "@ann/keeper"\n  source: market\n  replaces:\n    - keeper/v1\n',
    ...replacer("1.0.0", "v1"),
  });
  cleanup.push(made.remove);
  const host = await startHost({ dir: join(made.dir, "data"), builtins: join(made.dir, "app"), appVersion: "0.6.0" });
  cleanup.push(() => host.stop());
  await host.settle();
  const holder = () => host.services().find((service) => service.name === "keeper/v1")?.plugin ?? null;
  const ping = () => host.serviceHub.invoke("keeper/v1", "ping", {}, { plugin: "test" });
  assert.equal(holder(), "@ann/keeper");
  assert.equal(await ping(), "v1");

  made.write(replacer("2.0.0", "v2"));
  const answers = [];
  const calls = (async () => {
    while (answers.at(-1) !== "v2" && answers.length < 10000) {
      answers.push(await ping().catch((error) => `failed: ${error?.code ?? error?.message}`));
      await new Promise((resolve) => setImmediate(resolve));
    }
  })();
  await refresh(host);
  await calls;

  assert.equal(answers.at(-1), "v2", "the new version answers after the update");
  assert.deepEqual(answers.filter((answer) => !["v1", "builtin", "v2"].includes(answer)), [], "every call during the update was answered");
  assert.equal(holder(), "@ann/keeper");
  const keeper = host.status().find((entry) => entry.id === "keeper");
  assert.equal(keeper.state, "running");
  assert.deepEqual(keeper.replacedServices, [{ service: "keeper/v1", by: "@ann/keeper" }]);
});
