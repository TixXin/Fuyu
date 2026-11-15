import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, test } from "node:test";
import { startHost } from "@fuyu/plugin-base/host";
import { BISECT_REASON } from "../src/host/gate.mjs";
import { builtinFiles, config, sleep, until, workspace } from "./workspace.mjs";

const cleanup = [];
after(async () => {
  for (const step of cleanup) await step();
});

const FILES = {
  "ticker.mjs": `export const name = "ticker";
export function apply(ctx) {
  ctx.setInterval(() => {}, 1000);
  ctx.on("probe/tick", () => {});
}
`,
  "store.mjs": `import { Service } from "@fuyu/plugin-base";
export default class Store extends Service {
  constructor(ctx) {
    super(ctx, "store");
  }
}
`,
  "reader.mjs": `export const name = "reader";
export const inject = ["store"];
export function apply() {}
`,
  "flaky.mjs": `export const name = "flaky";
export function apply(ctx) {
  ctx.on("probe/flaky", () => {
    throw new Error("flaky broke");
  });
}
`,
};

const BUILTINS = [{ id: "inside", kind: "builtin", file: "ticker.mjs" }];

async function host(entries, { builtins, ...options } = {}) {
  const space = workspace({ ...FILES, ...(builtins ? builtinFiles(builtins, FILES) : {}), "plugins.yml": config(entries) });
  const started = await startHost({ dir: space.dir, ...(builtins ? { builtins: join(space.dir, "builtins") } : {}), ...options });
  cleanup.push(() => started.stop(), space.remove);
  await started.settle();
  return { host: started, space };
}

const byId = (status, id) => status.find((entry) => entry.id === id);
const stateOf = (running, id) => byId(running.status(), id)?.state;

test("a bisect switches the listed plugins off for this run only, says why, and brings them back when the list changes", async () => {
  const entries = [
    { id: "ticker", name: "./ticker.mjs" },
    { id: "store", name: "./store.mjs" },
    { id: "reader", name: "./reader.mjs" },
  ];
  const { host: running, space } = await host(entries, { watch: true });
  const before = readFileSync(join(space.dir, "plugins.yml"), "utf8");
  assert.deepEqual(running.bisect(["ticker", "store", "gone"]), { off: ["ticker", "store", "gone"], unknown: ["gone"] });
  assert.ok(await until(() => stateOf(running, "ticker") === "bisect" && stateOf(running, "reader") === "waiting"));
  const ticker = byId(running.status(), "ticker");
  assert.equal(ticker.reason, BISECT_REASON);
  assert.deepEqual(ticker.blocked, { by: "bisect" });
  assert.equal(ticker.usage.timers, 0);
  assert.equal(ticker.usage.listeners, 0);
  assert.equal(stateOf(running, "store"), "bisect");
  space.write({ "plugins.yml": config(entries) + "\n" });
  await sleep(600);
  assert.equal(stateOf(running, "ticker"), "bisect");
  running.bisect(["ticker"]);
  assert.ok(await until(() => stateOf(running, "store") === "running" && stateOf(running, "reader") === "running"));
  assert.equal(stateOf(running, "ticker"), "bisect");
  running.bisect([]);
  assert.ok(await until(() => stateOf(running, "ticker") === "running"));
  assert.equal(byId(running.status(), "ticker").usage.timers, 1);
  assert.equal(readFileSync(join(space.dir, "plugins.yml"), "utf8").trim(), before.trim());
  running.bisect(["ticker"]);
  assert.ok(await until(() => stateOf(running, "ticker") === "bisect"));
  await running.stop();
  const again = await startHost({ dir: space.dir });
  cleanup.push(() => again.stop());
  await again.settle();
  assert.equal(stateOf(again, "ticker"), "running");
  await again.stop();
});

test("built-in plugins cannot be switched off by a bisect, and a refused list changes nothing", async () => {
  const { host: running } = await host([{ id: "ticker", name: "./ticker.mjs" }], { builtins: BUILTINS });
  assert.throws(
    () => running.bisect(["ticker", "inside"]),
    (error) => error.code === "not-third-party" && /inside is builtin/.test(error.message) && error.data.refused[0].kind === "builtin",
  );
  await sleep(30);
  assert.equal(stateOf(running, "ticker"), "running");
  assert.equal(stateOf(running, "inside"), "running");
  assert.throws(() => running.bisect("ticker"), (error) => error.code === "bad-params" && error.data.field === "off");
  assert.throws(() => running.bisect([""]), (error) => error.code === "bad-params");
});

test("the list given at start keeps third-party plugins from ever starting and ignores built-in ones", async () => {
  const { host: running } = await host([{ id: "ticker", name: "./ticker.mjs" }], { builtins: BUILTINS, bisect: ["ticker", "inside"] });
  const ticker = byId(running.status(), "ticker");
  assert.equal(ticker.state, "bisect");
  assert.equal(ticker.usage.applyMs, null);
  assert.equal(stateOf(running, "inside"), "running");
  running.bisect([]);
  assert.ok(await until(() => stateOf(running, "ticker") === "running"));
});

test("disabled, auto-disabled and safe mode win over a bisect, and leaving the bisect does not free them", async () => {
  const { host: running } = await host([
    { id: "flaky", name: "./flaky.mjs" },
    { id: "off", name: "./ticker.mjs", disabled: true },
  ]);
  for (let i = 0; i < 5; i += 1) running.ctx.emit("probe/flaky");
  assert.ok(await until(() => stateOf(running, "flaky") === "auto-disabled"));
  running.bisect(["flaky", "off"]);
  await sleep(30);
  assert.equal(stateOf(running, "flaky"), "auto-disabled");
  assert.equal(stateOf(running, "off"), "disabled");
  running.bisect([]);
  await sleep(50);
  assert.equal(stateOf(running, "flaky"), "auto-disabled");
  assert.equal(stateOf(running, "off"), "disabled");

  const { host: safe } = await host([{ id: "ticker", name: "./ticker.mjs" }], { safe: "third-party", bisect: ["ticker"] });
  assert.equal(stateOf(safe, "ticker"), "safe-mode");
  safe.bisect([]);
  await sleep(50);
  assert.equal(stateOf(safe, "ticker"), "safe-mode");
});
