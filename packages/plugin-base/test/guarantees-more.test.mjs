import assert from "node:assert/strict";
import { after, test } from "node:test";
import { config, sleep, until, workspace } from "./workspace.mjs";
import { startHost } from "@fuyu/plugin-base/host";

const cleanup = [];
after(async () => {
  for (const step of cleanup) await step();
});

const TRACE = `globalThis.trace ??= [];\n`;

function provider(name, needs = []) {
  return `${TRACE}import { Service } from "@fuyu/plugin-base";
export default class P extends Service {
  static inject = ${JSON.stringify(needs)};
  constructor(ctx) {
    super(ctx, ${JSON.stringify(name)});
    globalThis.trace.push("start ${name}");
    ctx.effect(() => () => globalThis.trace.push("stop ${name}"));
  }
}
`;
}

function user(name, needs) {
  return `${TRACE}export const name = ${JSON.stringify(name)};
export const inject = ${JSON.stringify(needs)};
export function apply(ctx) {
  globalThis.trace.push("start ${name}");
  ctx.effect(() => () => globalThis.trace.push("stop ${name}"));
}
`;
}

const FILES = {
  "c.mjs": provider("c"),
  "b.mjs": provider("b", ["c"]),
  "a.mjs": user("a", ["b"]),
  "one.mjs": provider("svc"),
  "two.mjs": provider("svc"),
  "async-broken.mjs": `${TRACE}export const name = "async-broken";
export async function apply(ctx) {
  ctx.effect(() => {
    globalThis.trace.push("effect up");
    return () => globalThis.trace.push("effect down");
  });
  ctx.on("probe/async", () => globalThis.trace.push("heard"));
  await new Promise((resolve) => setTimeout(resolve, 20));
  throw new Error("async broken on purpose");
}
`,
  "ticker.mjs": `${TRACE}export const name = "ticker";
export function apply(ctx) {
  globalThis.ticks = 0;
  globalThis.heard = 0;
  ctx.effect(() => {
    const timer = setInterval(() => (globalThis.ticks += 1), 5);
    return () => clearInterval(timer);
  });
  ctx.on("probe/tick", () => (globalThis.heard += 1));
}
`,
  "managed.mjs": `export const name = "managed";
export function apply(ctx) {
  globalThis.managed = typeof ctx.setInterval === "function" && typeof ctx.setTimeout === "function";
}
`,
  "configured.mjs": `${TRACE}export const name = "configured";
export function apply(ctx, config) {
  globalThis.trace.push("start configured " + JSON.stringify(config ?? {}));
  ctx.effect(() => () => globalThis.trace.push("stop configured"));
}
`,
  "other.mjs": user("other", []),
};

async function host(entries) {
  globalThis.trace = [];
  const space = workspace({ ...FILES, "plugins.yml": config(entries) });
  const started = await startHost({ dir: space.dir });
  cleanup.push(() => started.stop(), space.remove);
  await started.settle();
  const entry = (id) => [...started.ctx.loader.entries()].find((item) => item.options.id === id);
  const state = (id) => started.status().find((item) => item.id === id)?.state;
  return { ...started, entry, state, trace: globalThis.trace };
}

const CONFLICT = [
  { id: "first", name: "./one.mjs" },
  { id: "second", name: "./two.mjs" },
];

test("a second provider of the same service fails without touching the first, and its error names the service", async () => {
  const { status, state, stop } = await host(CONFLICT);
  assert.equal(state("first"), "running");
  const second = status().find((item) => item.id === "second");
  assert.equal(second.state, "failed");
  assert.match(second.error, /service "svc" has been registered at </);
  await stop();
});

test("the status of a conflicting provider names the plugin that already provides the service", async () => {
  const { status, stop } = await host(CONFLICT);
  const second = status().find((item) => item.id === "second");
  await stop();
  assert.match(second.error ?? "", /<first>|"first"/);
});

test("a dependency chain starts in order, stops above a provider that goes away, and starts again when it returns", async () => {
  const { entry, state, trace, stop } = await host([
    { id: "a", name: "./a.mjs" },
    { id: "b", name: "./b.mjs" },
    { id: "c", name: "./c.mjs" },
  ]);
  assert.deepEqual(trace, ["start c", "start b", "start a"]);
  trace.length = 0;
  await entry("c").update({ disabled: true });
  assert.ok(await until(() => state("a") === "waiting" && state("b") === "waiting"));
  assert.deepEqual([...trace].sort(), ["stop a", "stop b", "stop c"]);
  assert.ok(trace.indexOf("stop a") < trace.indexOf("stop b"), trace.join(", "));
  trace.length = 0;
  await entry("c").update({ disabled: false });
  assert.ok(await until(() => state("a") === "running"));
  assert.deepEqual(trace, ["start c", "start b", "start a"]);
  await stop();
});

test("a plugin whose async apply rejects is failed, and its effects and listeners are undone", async () => {
  const { ctx, state, trace, stop } = await host([{ id: "async-broken", name: "./async-broken.mjs" }]);
  assert.ok(await until(() => state("async-broken") === "failed"));
  assert.deepEqual(trace, ["effect up", "effect down"]);
  ctx.emit("probe/async");
  assert.deepEqual(trace, ["effect up", "effect down"]);
  await stop();
});

test("timers in an effect and event listeners never fire after the plugin is disabled", async () => {
  const { ctx, entry, stop } = await host([{ id: "ticker", name: "./ticker.mjs" }]);
  assert.ok(await until(() => globalThis.ticks > 2));
  ctx.emit("probe/tick");
  assert.equal(globalThis.heard, 1);
  await entry("ticker").update({ disabled: true });
  const ticks = globalThis.ticks;
  await sleep(40);
  ctx.emit("probe/tick");
  assert.equal(globalThis.ticks, ticks);
  assert.equal(globalThis.heard, 1);
  await stop();
});

test("the kernel gives plugins managed timers that stop with them", async () => {
  const { stop } = await host([{ id: "managed", name: "./managed.mjs" }]);
  await stop();
  assert.equal(globalThis.managed, true);
});

test("changing one plugin's config restarts only that plugin, with the new config", async () => {
  const { entry, trace, stop } = await host([
    { id: "configured", name: "./configured.mjs", extra: "  config:\n    lang: en\n" },
    { id: "other", name: "./other.mjs" },
  ]);
  assert.deepEqual([...trace].sort(), ["start configured {\"lang\":\"en\"}", "start other"]);
  trace.length = 0;
  await entry("configured").update({ config: { lang: "zh" } });
  assert.ok(await until(() => trace.length >= 2));
  await sleep(20);
  assert.deepEqual(trace, ["stop configured", "start configured {\"lang\":\"zh\"}"]);
  await stop();
});

test("stopping the host runs the cleanup of every plugin, dependents first", async () => {
  const { trace, stop } = await host([
    { id: "a", name: "./a.mjs" },
    { id: "b", name: "./b.mjs" },
    { id: "c", name: "./c.mjs" },
    { id: "other", name: "./other.mjs" },
  ]);
  trace.length = 0;
  await stop();
  assert.deepEqual([...trace].sort(), ["stop a", "stop b", "stop c", "stop other"]);
  assert.ok(trace.indexOf("stop a") < trace.indexOf("stop b") && trace.indexOf("stop b") < trace.indexOf("stop c"), trace.join(", "));
});

test("a plugin that imports fuyu-plugin gets the same kernel as @fuyu/plugin-base, so its services reach the others", async () => {
  const space = workspace({
    "alias.mjs": `import * as alias from "fuyu-plugin";
import * as base from "@fuyu/plugin-base";
globalThis.sameKernel = alias.Service === base.Service && alias.Context === base.Context;
export default class Aliased extends alias.Service {
  constructor(ctx) {
    super(ctx, "aliased");
  }
}
`,
    "uses.mjs": user("uses", ["aliased"]),
    "plugins.yml": config([
      { id: "alias", name: "./alias.mjs" },
      { id: "uses", name: "./uses.mjs" },
    ]),
  });
  cleanup.push(space.remove);
  const host = await startHost({ dir: space.dir });
  cleanup.push(() => host.stop());
  await host.settle();
  assert.equal(globalThis.sameKernel, true);
  assert.deepEqual(host.status().map((entry) => [entry.id, entry.state]), [["alias", "running"], ["uses", "running"]]);
  await host.stop();
});
