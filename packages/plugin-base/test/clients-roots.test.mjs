import assert from "node:assert/strict";
import { realpathSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { after, test } from "node:test";
import { startHost } from "@fuyu/plugin-base/host";
import { workspace } from "./workspace.mjs";

const cleanup = [];
after(async () => {
  for (const step of cleanup) await step();
});

function manifest(name, app) {
  return JSON.stringify({
    name,
    version: "1.0.0",
    type: "module",
    license: "MIT",
    repository: "github:ann/plugin",
    engines: { fuyu: ">=0.5.0" },
    fuyu: { manifest: 1, displayName: { "zh-CN": "示例", en: "Example" }, description: { "zh-CN": "示例插件", en: "An example plugin" }, icon: "icon.png", categories: ["utilities"], ...app },
  });
}

async function open(files) {
  const made = workspace(files);
  cleanup.push(made.remove);
  const data = join(made.dir, "data");
  const host = await startHost({ dir: data, appVersion: "0.6.0" });
  cleanup.push(() => host.stop());
  await host.settle();
  return { made, data, host };
}

const byId = (host, id) => host.status().find((entry) => entry.id === id);

test("the host tells Rust which folder each dev/<id>/ path comes from, and only for paths it registered", async () => {
  const { made, host } = await open({
    "data/plugins.yml": "- id: clock\n  source: dev\n  path: ../app/clock\n- id: quiet\n  source: dev\n  path: ../app/quiet\n- id: hello\n  name: ./hello/host.mjs\n",
    "app/clock/package.json": manifest("@ann/clock", { client: { island: "dist/island.js" } }),
    "app/clock/dist/island.js": "export default () => {};\n",
    "app/quiet/package.json": manifest("@ann/quiet", {}),
    "data/hello/host.mjs": 'export const name = "hello";\nexport const inject = ["clients"];\nexport function apply(ctx) {\n  ctx.clients.add("island", new URL("./island.js", import.meta.url).href);\n}\n',
    "data/hello/island.js": "export default () => {};\n",
  });
  assert.equal(byId(host, "clock").state, "running");
  assert.deepEqual(host.clients().map((entry) => entry.path).sort(), ["dev/clock/dist/island.js", "hello/island.js"]);
  assert.deepEqual(host.clientRoots(), [{ prefix: "dev/clock", dir: realpathSync(join(made.dir, "app/clock")) }]);
  assert.deepEqual(host.clientRoots([]), []);
  assert.equal(byId(host, "clock").unreachableClients, undefined);
});

test("window code that is in no folder Fuyu can read is reported on the plugin instead of vanishing", async () => {
  const made = workspace({
    "elsewhere/@ann/badge/package.json": manifest("@ann/badge", { client: { island: "dist/island.js", settings: "dist/settings.js" } }),
    "elsewhere/@ann/badge/dist/island.js": "export default () => {};\n",
    "elsewhere/@ann/badge/dist/settings.js": "export default () => {};\n",
    "data/plugins.yml": '- id: "@ann/badge"\n  source: manual\n',
    "data/packages/@ann/.keep": "",
  });
  cleanup.push(made.remove);
  symlinkSync(join(made.dir, "elsewhere/@ann/badge"), join(made.dir, "data/packages/@ann/badge"), "junction");
  const host = await startHost({ dir: join(made.dir, "data"), appVersion: "0.6.0" });
  cleanup.push(() => host.stop());
  await host.settle();
  const status = byId(host, "@ann/badge");
  assert.equal(status.state, "running", JSON.stringify(status));
  assert.deepEqual(status.unreachableClients, ["island", "settings"]);
  assert.deepEqual(host.clients(), []);
  assert.deepEqual(host.clientRoots(), []);
});
