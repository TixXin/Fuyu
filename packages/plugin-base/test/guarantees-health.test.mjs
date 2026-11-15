import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, test } from "node:test";
import { startHost } from "@fuyu/plugin-base/host";
import { builtinFiles, config, sleep, until, workspace } from "./workspace.mjs";

const cleanup = [];
after(async () => {
  for (const step of cleanup) await step();
});

const FILES = {
  "busy.mjs": `export const name = "busy";
export const inject = ["clients"];
export function apply(ctx) {
  ctx.clients.add("island", new URL("./ui.js", import.meta.url).href);
  ctx.on("probe/work", () => {});
  ctx.on("probe/other", () => {});
  ctx.setInterval(() => {
    const until = performance.now() + 2;
    while (performance.now() < until);
  }, 5);
  ctx.setTimeout(() => {}, 60000);
}
`,
  "ui.js": "export default () => {};\n",
  "slow.mjs": `export const name = "slow";
export async function apply(ctx) {
  await new Promise((resolve) => setTimeout(resolve, 40));
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
  ctx.setInterval(() => {}, 1000);
}
`,
};

async function host(entries, { builtins, ...options } = {}) {
  const space = workspace({ ...FILES, ...(builtins ? builtinFiles(builtins, FILES) : {}), "plugins.yml": config(entries) });
  const started = await startHost({ dir: space.dir, ...(builtins ? { builtins: join(space.dir, "builtins") } : {}), ...options });
  cleanup.push(() => started.stop(), space.remove);
  await started.settle();
  return { host: started, space };
}

const SAFE_BUILTINS = [
  { id: "store", kind: "builtin", file: "store.mjs" },
  { id: "reader", kind: "essential", file: "reader.mjs" },
];

const byId = (status, id) => status.find((entry) => entry.id === id);

test("each plugin reports its timers, listeners, services, CPU and apply time", async () => {
  const { host: running } = await host([
    { id: "busy", name: "./busy.mjs" },
    { id: "slow", name: "./slow.mjs" },
    { id: "store", name: "./store.mjs" },
  ]);
  await until(() => byId(running.status(), "busy").usage.calls >= 5 && byId(running.status(), "slow").usage.applyMs !== null);
  const status = running.status();
  const busy = byId(status, "busy").usage;
  assert.equal(busy.timers, 2);
  assert.equal(busy.listeners, 2);
  assert.equal(busy.clients, 1);
  assert.ok(busy.cpuMs >= 5, `busy used ${busy.cpuMs} ms`);
  assert.ok(busy.applyMs >= 0);
  assert.ok(byId(status, "slow").usage.applyMs >= 35, `slow took ${byId(status, "slow").usage.applyMs} ms`);
  assert.equal(byId(status, "store").usage.services, 1);
  assert.equal(byId(status, "store").kind, "third-party");
  await running.stop();
});

test("a plugin that keeps failing is switched off for this run only, without touching plugins.yml", async () => {
  const entries = [
    { id: "flaky", name: "./flaky.mjs" },
    { id: "busy", name: "./busy.mjs" },
  ];
  const { host: running, space } = await host(entries, { watch: true });
  const before = readFileSync(join(space.dir, "plugins.yml"), "utf8");
  for (let i = 0; i < 4; i += 1) running.ctx.emit("probe/flaky");
  await sleep(30);
  assert.equal(byId(running.status(), "flaky").state, "running");
  running.ctx.emit("probe/flaky");
  assert.ok(await until(() => byId(running.status(), "flaky").state === "auto-disabled"));
  const flaky = byId(running.status(), "flaky");
  assert.match(flaky.reason, /5 errors within 60 s/);
  assert.match(flaky.reason, /flaky broke/);
  assert.deepEqual(flaky.blocked, { by: "errors", errors: 5, windowMs: 60000 });
  assert.equal(flaky.usage.timers, 0);
  assert.equal(flaky.usage.listeners, 0);
  assert.equal(byId(running.status(), "busy").state, "running");
  space.write({ "plugins.yml": config(entries) + "\n" });
  await sleep(600);
  assert.equal(byId(running.status(), "flaky").state, "auto-disabled");
  assert.equal(readFileSync(join(space.dir, "plugins.yml"), "utf8").trim(), before.trim());
  await running.stop();
  const again = await startHost({ dir: space.dir });
  cleanup.push(() => again.stop());
  await again.settle();
  assert.equal(byId(again.status(), "flaky").state, "running");
  await again.stop();
});

test("errors spread out beyond the window do not switch a plugin off", async () => {
  const { host: running } = await host([{ id: "flaky", name: "./flaky.mjs" }], { faultLimit: { errors: 3, windowMs: 50 } });
  for (let i = 0; i < 5; i += 1) {
    running.ctx.emit("probe/flaky");
    await sleep(30);
  }
  const flaky = byId(running.status(), "flaky");
  assert.equal(flaky.state, "running");
  assert.equal(flaky.usage.errors, 5);
  assert.match(flaky.lastError.text, /flaky broke/);
  await running.stop();
});

test("safe mode third-party keeps built-in plugins and holds back the rest, saying why", async () => {
  const { host: running } = await host([{ id: "busy", name: "./busy.mjs" }], { safe: "third-party", builtins: SAFE_BUILTINS });
  const status = running.status();
  assert.equal(byId(status, "store").state, "running");
  assert.equal(byId(status, "reader").state, "running");
  assert.equal(byId(status, "busy").state, "safe-mode");
  assert.match(byId(status, "busy").reason, /safe mode "third-party"/);
  assert.deepEqual(byId(status, "busy").blocked, { by: "safe-mode", mode: "third-party" });
  assert.equal(byId(status, "busy").usage.calls, 0);
  assert.equal(running.info().safe, "third-party");
  await running.stop();
});

test("safe mode minimal keeps only essential plugins, and their users wait for what is held back", async () => {
  const { host: running } = await host([], { safe: "minimal", builtins: SAFE_BUILTINS });
  const status = running.status();
  assert.equal(byId(status, "store").state, "safe-mode");
  assert.equal(byId(status, "reader").state, "waiting");
  assert.deepEqual(byId(status, "reader").waitingFor, ["store"]);
  await running.stop();
});

test("an unknown safe mode is refused", async () => {
  const space = workspace({ ...FILES, "plugins.yml": config([{ id: "busy", name: "./busy.mjs" }]) });
  cleanup.push(space.remove);
  await assert.rejects(startHost({ dir: space.dir, safe: "everything" }), /unknown safe mode/);
});
