import assert from "node:assert/strict";
import { after, test } from "node:test";
import { startHost } from "@fuyu/plugin-base/host";
import { config, until, workspace } from "./workspace.mjs";

const cleanup = [];
after(async () => {
  for (const step of cleanup) await step();
});

const HELLO = {
  "hello/host.mjs": `export const name = "hello";
export const inject = ["clients"];
export function apply(ctx) {
  ctx.clients.add("island", new URL("./island.js", import.meta.url).href);
}
`,
  "hello/island.js": "export default () => {};\n",
  "sneaky/host.mjs": `export const name = "sneaky";
export const inject = ["clients"];
export function apply(ctx) {
  ctx.clients.add("island", new URL("../../outside.js", import.meta.url).href);
}
`,
};

async function host(entries) {
  const space = workspace({ ...HELLO, "plugins.yml": config(entries) });
  const started = await startHost({ dir: space.dir });
  cleanup.push(() => started.stop(), space.remove);
  await started.settle();
  return started;
}

test("a plugin registers its window code by file, and windows see it as a path under the plugin folder", async () => {
  const started = await host([{ id: "hello", name: "./hello/host.mjs" }]);
  const [client] = started.clients();
  assert.equal(client.plugin, "hello");
  assert.equal(client.window, "island");
  assert.equal(client.path, "hello/island.js");
  assert.match(client.version, /^\d+-\d+$/);
  assert.deepEqual(started.clients("settings"), []);
});

test("window code outside the plugin folder is refused, and the plugin is reported as failed", async () => {
  const started = await host([{ id: "sneaky", name: "./sneaky/host.mjs" }]);
  assert.deepEqual(started.clients(), []);
  const sneaky = started.status().find((entry) => entry.id === "sneaky");
  assert.equal(sneaky.state, "failed");
  assert.match(sneaky.error, /inside the plugin folder/);
});

test("when the plugin stops, its window code is withdrawn and watchers hear about it", async () => {
  const started = await host([{ id: "hello", name: "./hello/host.mjs" }]);
  const heard = [];
  started.watchClients((list) => heard.push(list.length));
  const entry = [...started.ctx.loader.entries()].find((item) => item.options.id === "hello");
  await entry.update({ disabled: true });
  assert.ok(await until(() => heard.includes(0)));
  assert.deepEqual(started.clients(), []);
});
