import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import { config, sleep, workspace } from "./workspace.mjs";
import { startHost } from "@fuyu/plugin-base/host";

const MAIN = fileURLToPath(new URL("../src/host/main.mjs", import.meta.url));
const cleanup = [];
after(async () => {
  for (const step of cleanup) await step();
});

function listener(name, fails) {
  return `export const name = ${JSON.stringify(name)};
export function apply(ctx) {
  ctx.on("probe/shout", () => {
    globalThis.heard.push(${JSON.stringify(name)});
    ${fails ? `throw new Error("listener of ${name} broke");` : ""}
  });
}
`;
}

const FILES = {
  "loud.mjs": listener("loud", true),
  "quiet.mjs": listener("quiet", false),
  "rejects.mjs": `export const name = "rejects";
export function apply() {
  setTimeout(() => Promise.reject(new Error("stray rejection from a plugin")), 10);
}
`,
  "throws.mjs": `export const name = "throws";
export function apply() {
  setTimeout(() => {
    throw new Error("stray throw from a plugin");
  }, 10);
}
`,
};

test("a listener that throws does not stop other plugins' listeners for the same event", { todo: "Cordis emit() calls listeners in a plain loop: the first throw skips the rest and reaches the emitter" }, async () => {
  globalThis.heard = [];
  const space = workspace({ ...FILES, "plugins.yml": config([{ id: "loud", name: "./loud.mjs" }, { id: "quiet", name: "./quiet.mjs" }]) });
  const host = await startHost({ dir: space.dir });
  cleanup.push(() => host.stop(), space.remove);
  await host.settle();
  try {
    host.ctx.emit("probe/shout");
  } catch {
    globalThis.heard.push("emitter saw the error");
  }
  await host.stop();
  assert.deepEqual(globalThis.heard, ["loud", "quiet"]);
});

async function survives(plugin) {
  const space = workspace({ ...FILES, "plugins.yml": config([{ id: plugin, name: `./${plugin}.mjs` }]) });
  cleanup.push(space.remove);
  const child = spawn(process.execPath, ["--disallow-code-generation-from-strings", MAIN, "--dir", space.dir], { stdio: ["pipe", "pipe", "pipe"] });
  cleanup.push(() => child.kill());
  const lines = createInterface({ input: child.stdout });
  const ready = new Promise((resolve) => lines.on("line", (line) => JSON.parse(line).method === "ready" && resolve()));
  const exited = once(child, "exit").then(([code]) => ({ code }));
  const first = await Promise.race([ready.then(() => null), exited]);
  if (first) return first;
  const later = await Promise.race([sleep(300).then(() => null), exited]);
  return later ?? { code: "alive" };
}

test("a stray promise rejection in a plugin does not take the host down", { todo: "main.mjs has no unhandledRejection handler, so Node exits and Rust restarts the host with every plugin" }, async () => {
  assert.deepEqual(await survives("rejects"), { code: "alive" });
});

test("an uncaught throw in a plugin's timer does not take the host down", { todo: "main.mjs has no uncaughtException handler, so Node exits and Rust restarts the host with every plugin" }, async () => {
  assert.deepEqual(await survives("throws"), { code: "alive" });
});
