import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { setFlagsFromString } from "node:v8";
import { runInNewContext } from "node:vm";
import { after, test } from "node:test";
import { Context } from "@fuyu/plugin-base";
import { PLUGINS, config, resetProbe, until, workspace } from "./workspace.mjs";
import { startHost } from "@fuyu/plugin-base/host";

const cleanup = [];
after(async () => {
  for (const step of cleanup) await step();
});

async function host(entries, files = PLUGINS, options = {}) {
  const space = workspace({ ...files, "plugins.yml": config(entries) });
  const started = await startHost({ dir: space.dir, ...options });
  cleanup.push(() => started.stop(), space.remove);
  await started.settle();
  return { ...started, space };
}

const byId = (status, id) => status.find((entry) => entry.id === id);

test("a plugin does not start until the services it needs are provided, and says which one it waits for", async () => {
  const probe = resetProbe();
  const { status, stop } = await host([{ id: "user", name: "./user.mjs" }]);
  assert.equal(probe.applied, 0);
  const { usage, ...user } = byId(status(), "user");
  assert.deepEqual(user, { id: "user", name: "./user.mjs", state: "waiting", kind: "third-party", source: "file", waitingFor: ["counter"] });
  assert.equal(usage.timers, 0);
  await stop();
});

test("the load order follows dependencies, not the order in the configuration", async () => {
  const probe = resetProbe();
  const { status, ctx, stop } = await host([
    { id: "user", name: "./user.mjs" },
    { id: "counter", name: "./counter.mjs" },
  ]);
  assert.equal(probe.applied, 1);
  assert.equal(ctx.counter.value, 1);
  assert.equal(byId(status(), "user").state, "running");
  await stop();
});

test("every cleanup runs exactly once when a plugin is disabled, and again on the next start", async () => {
  const probe = resetProbe();
  const { ctx, stop } = await host([
    { id: "counter", name: "./counter.mjs" },
    { id: "user", name: "./user.mjs" },
  ]);
  const user = [...ctx.loader.entries()].find((entry) => entry.options.id === "user");
  await user.update({ disabled: true });
  assert.deepEqual([probe.live, probe.cleaned], [0, 1]);
  ctx.emit("probe/ping");
  assert.equal(probe.pings, 0, "a disabled plugin's listeners are gone");
  await user.update({ disabled: false });
  await until(() => probe.applied === 2);
  assert.deepEqual([probe.live, probe.cleaned], [1, 1]);
  await stop();
  assert.deepEqual([probe.live, probe.cleaned], [0, 2]);
});

test("a plugin that throws while starting is reported as failed and what it registered is undone", async () => {
  const probe = resetProbe();
  const { status, stop } = await host([{ id: "broken", name: "./broken.mjs" }]);
  const broken = byId(status(), "broken");
  assert.equal(broken.state, "failed");
  assert.match(broken.error, /broken on purpose/);
  assert.equal(probe.live, 0);
  await stop();
});

test("a plugin whose file is missing is reported as failed, not left silent", async () => {
  resetProbe();
  const { status, stop } = await host([{ id: "ghost", name: "./ghost.mjs" }]);
  const ghost = byId(status(), "ghost");
  assert.equal(ghost.state, "failed");
  assert.match(ghost.error, /ghost\.mjs/);
  await stop();
});

test("when the provider of a service goes away its users stop, and start again when it comes back", async () => {
  const probe = resetProbe();
  const { ctx, status, stop } = await host([
    { id: "counter", name: "./counter.mjs" },
    { id: "user", name: "./user.mjs" },
  ]);
  const counter = [...ctx.loader.entries()].find((entry) => entry.options.id === "counter");
  await counter.update({ disabled: true });
  assert.deepEqual([probe.live, probe.cleaned], [0, 1]);
  assert.ok(await until(() => byId(status(), "user").state === "waiting"));
  assert.deepEqual(byId(status(), "user").waitingFor, ["counter"]);
  await counter.update({ disabled: false });
  await until(() => probe.applied === 2);
  assert.equal(probe.provided, 2);
  assert.equal(byId(status(), "user").state, "running");
  await stop();
});

test("a plugin installed outside the host's directory gets the same kernel as the host", async () => {
  resetProbe();
  const outside = workspace({
    "ext/host.mjs": `import { Context, Service } from "@fuyu/plugin-base";
export default class Ext extends Service {
  constructor(ctx) {
    super(ctx, "ext");
    globalThis.probe.sameKernel = ctx instanceof Context;
  }
}
`,
  });
  cleanup.push(outside.remove);
  const url = pathToFileURL(join(outside.dir, "ext", "host.mjs")).href;
  const { ctx, status, stop } = await host([{ id: "ext", name: JSON.stringify(url) }]);
  assert.equal(byId(status(), "ext").state, "running");
  assert.equal(globalThis.probe.sameKernel, true);
  assert.ok(ctx instanceof Context);
  await stop();
});

test("editing the configuration file disables and enables plugins", async () => {
  const probe = resetProbe();
  const entries = [
    { id: "counter", name: "./counter.mjs" },
    { id: "user", name: "./user.mjs" },
  ];
  const { space, stop } = await host(entries, PLUGINS, { watch: true });
  assert.equal(probe.live, 1);
  space.write({ "plugins.yml": config([entries[0], { ...entries[1], disabled: true }]) });
  assert.ok(await until(() => probe.live === 0), "disabled by the file");
  space.write({ "plugins.yml": config(entries) });
  assert.ok(await until(() => probe.live === 1), "enabled again by the file");
  await stop();
});

test("loading and unloading a plugin 1000 times leaves no timers, listeners or effects behind", async () => {
  const probe = resetProbe();
  const { ctx, stop } = await host([
    { id: "counter", name: "./counter.mjs" },
    { id: "user", name: "./user.mjs" },
  ]);
  const user = [...ctx.loader.entries()].find((entry) => entry.options.id === "user");
  const listeners = () => ctx.events._hooks["probe/ping"]?.length ?? 0;
  setFlagsFromString("--expose-gc");
  const gc = runInNewContext("gc");
  gc();
  const heap = process.memoryUsage().heapUsed;
  for (let round = 0; round < 1000; round += 1) {
    await user.update({ disabled: true });
    await user.update({ disabled: false });
  }
  await until(() => probe.applied === 1001);
  assert.equal(probe.applied, 1001);
  assert.equal(probe.cleaned, 1000);
  assert.equal(probe.live, 1);
  assert.equal(listeners(), 1);
  gc();
  const grown = (process.memoryUsage().heapUsed - heap) / 1048576;
  assert.ok(grown < 8, `the heap grew by ${grown.toFixed(1)} MB over 1000 rounds`);
  await stop();
  assert.equal(probe.live, 0);
  assert.equal(listeners(), 0);
});
