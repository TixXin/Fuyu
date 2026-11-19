import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { startHost } from "@fuyu/plugin-base/host";
import { marketV1 } from "@fuyu/plugin-services";
import { packFiles } from "../../packages/plugin-manifest/src/index.mjs";

function fuyuFile(name, version, answer) {
  const pkg = {
    name,
    version,
    type: "module",
    license: "MIT",
    repository: "https://github.com/someone/clock",
    engines: { fuyu: ">=0.3.10" },
    fuyu: {
      manifest: 1,
      displayName: { "zh-CN": "时钟", en: "Clock" },
      description: { "zh-CN": "悬浮岛时钟", en: "Island clock" },
      categories: ["utilities"],
      icon: "assets/icon.svg",
      platforms: ["windows", "macos"],
      host: "dist/host.js",
      network: [],
      nodeApis: [],
      provides: [],
      replaces: [],
      slots: [],
      inject: { required: [], optional: [] },
      commands: [],
      builtWith: "2.0.0",
    },
  };
  const host = `import { answer } from "./answer.js";
export const name = ${JSON.stringify(name)};
export function apply(ctx) {
  const me = { answer, live: true };
  globalThis.marketReloadProbe[${JSON.stringify(name)}] = me;
  ctx.effect(() => () => { me.live = false; });
}
`;
  const { zip } = packFiles([
    { path: "package.json", data: `${JSON.stringify(pkg, null, 2)}\n` },
    { path: "assets/icon.svg", data: '<svg xmlns="http://www.w3.org/2000/svg"/>\n' },
    { path: "dist/host.js", data: host },
    { path: "dist/answer.js", data: `export const answer = ${JSON.stringify(answer)};\n` },
  ]);
  return Buffer.from(zip).toString("base64");
}

async function startWithUpdater(root, builtinsDir) {
  writeFileSync(
    join(builtinsDir, "builtins.json"),
    JSON.stringify({ format: 1, plugins: [{ id: "updater", kind: "essential", root: "updater", host: "host/index.mjs", background: [], provides: ["market/v1"] }] }),
  );
  mkdirSync(join(builtinsDir, "updater", "host"), { recursive: true });
  const entryUrl = new URL("../../src/features/updater/host/index.mjs", import.meta.url).href;
  writeFileSync(join(builtinsDir, "updater", "host", "index.mjs"), `export { name, apply } from ${JSON.stringify(entryUrl)};\n`);
  writeFileSync(join(root, "plugins.yml"), "[]\n");
  const host = await startHost({ dir: root, builtins: builtinsDir, appVersion: "0.3.11" });
  await host.settle();
  return host;
}

test("installing a newer .fuyu over an installed plugin runs the new host code and leaves the other plugins running", async () => {
  const root = mkdtempSync(join(tmpdir(), "fuyu-update-reload-"));
  const builtinsDir = mkdtempSync(join(tmpdir(), "fuyu-update-reload-builtins-"));
  globalThis.marketReloadProbe = {};
  const probe = globalThis.marketReloadProbe;
  let host = null;
  try {
    host = await startWithUpdater(root, builtinsDir);
    const call = (method, params) => host.serviceHub.windowCall("service.call", { service: marketV1.name, method, params }, "settings");
    await call("setManualAllowed", { allowed: true });
    await call("installFile", { base64: fuyuFile("@someone/clock", "1.0.0", "v1") });
    await call("installFile", { base64: fuyuFile("@someone/alarm", "1.0.0", "alarm") });
    await host.settle();
    const first = probe["@someone/clock"];
    const alarm = probe["@someone/alarm"];
    assert.equal(first?.answer, "v1");
    assert.equal(alarm?.answer, "alarm");

    await call("installFile", { base64: fuyuFile("@someone/clock", "2.0.0", "v2") });
    await host.settle();

    assert.equal(probe["@someone/clock"].answer, "v2", "the host imports the new host file and the new file it imports");
    assert.equal(first.live, false, "the old instance was disposed");
    assert.equal(probe["@someone/alarm"], alarm, "the other plugin was not restarted");
    assert.equal(alarm.live, true);
    const status = host.status().find((entry) => entry.id === "@someone/clock");
    assert.equal(status?.state, "running", JSON.stringify(status));
  } finally {
    if (host) await host.stop();
    rmSync(root, { recursive: true, force: true });
    rmSync(builtinsDir, { recursive: true, force: true });
  }
});
