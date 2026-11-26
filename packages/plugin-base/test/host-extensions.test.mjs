import assert from "node:assert/strict";
import { join } from "node:path";
import { after, test } from "node:test";
import { Service } from "@fuyu/plugin-base";
import { createLoader, createSlots } from "@fuyu/plugin-base/client";
import { startHost } from "@fuyu/plugin-base/host";
import { installInjectableAccessor } from "../src/host/owner.mjs";
import { workspace } from "./workspace.mjs";

const cleanup = [];
after(async () => {
  for (const step of [...cleanup].reverse()) await step();
});

class Badges {
  constructor() {
    this.badges = new Map();
    this.listeners = new Set();
  }

  install(ctx) {
    const badges = this;
    installInjectableAccessor(ctx, "badge", () => Object.freeze({ set: (plugin, text) => badges.set(plugin, text) }));
  }

  set(plugin, text) {
    this.badges.set(plugin, text);
    for (const listener of this.listeners) listener();
  }

  statusOf(plugin, state) {
    return state === "running" && this.badges.has(plugin) ? { badge: this.badges.get(plugin) } : null;
  }

  watch(listener) {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }
}

async function hostWith(files, options) {
  const made = workspace(files);
  cleanup.push(made.remove);
  const host = await startHost({ dir: join(made.dir, "data"), ...options });
  cleanup.push(() => host.stop());
  await host.settle();
  return host;
}

const FILES = {
  "data/plugins.yml": "- id: badged\n  name: ./badged.mjs\n",
  "data/badged.mjs": 'export const name = "badged";\nexport const inject = ["badge"];\nexport function apply(ctx) {\n  ctx.badge.set("badged", "3");\n}\n',
};

test("an app's host extension is created once, reachable on the host, and adds its own fields to the plugin status", async () => {
  let made = 0;
  const host = await hostWith(FILES, { extensions: [{ name: "badges", create: () => (made += 1, new Badges()) }] });
  assert.equal(made, 1);
  assert.ok(host.badges instanceof Badges);
  assert.deepEqual(host.extensions, [host.badges]);
  const status = host.status().find((item) => item.id === "badged");
  assert.equal(status.state, "running");
  assert.equal(status.badge, "3");
  let changes = 0;
  const stop = host.watchStatus(() => void (changes += 1));
  host.badges.set("badged", "4");
  const deadline = Date.now() + 2000;
  while (changes === 0 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
  stop();
  assert.equal(host.status().find((item) => item.id === "badged").badge, "4");
});

test("without extensions the host injects nothing app-specific, so a plugin asking for it waits", async () => {
  const host = await hostWith(FILES, { extensions: [] });
  assert.deepEqual(host.extensions, []);
  assert.notEqual(host.status().find((item) => item.id === "badged").state, "running");
});

test("a window loader installs the app's client services under their names and injects them", async () => {
  class Hello extends Service {
    constructor(ctx, options) {
      super(ctx, "hello");
      this.who = options.who;
    }

    greet() {
      return `hi ${this.who}`;
    }
  }
  const registry = createSlots({});
  const loader = createLoader({
    registry,
    base: "http://plugins.test",
    who: "there",
    appServices: [{ name: "hello", service: Hello, options: (options) => ({ who: options.who }) }],
    checkFile: async () => {},
    importModule: async () => ({ name: "greeter", inject: ["hello"], apply: (ctx) => void (globalThis.greeting = ctx.hello.greet()) }),
  });
  await loader.sync([{ id: "greeter:island", plugin: "greeter", path: "greeter/island.js", version: "1" }]);
  assert.equal(globalThis.greeting, "hi there");
  delete globalThis.greeting;
});
