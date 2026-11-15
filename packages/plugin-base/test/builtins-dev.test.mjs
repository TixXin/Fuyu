import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import { sleep, workspace } from "./workspace.mjs";

const MAIN = fileURLToPath(new URL("../src/host/main.mjs", import.meta.url));
const cleanup = [];
after(async () => {
  for (const step of cleanup) await step();
});

const version = (who, n) => `export const name = ${JSON.stringify(who)};\nexport function apply() {\n  console.error("${who} version ${n}");\n}\n`;

const CLOCK = `import { label } from "../label.mjs";
export const name = "clock";
export function apply() {
  console.error("clock version " + label);
}
`;

function launch(files) {
  const space = workspace(files);
  const args = ["--expose-internals", MAIN, "--dir", join(space.dir, "data"), "--builtins", join(space.dir, "app"), "--dev"];
  const child = spawn(process.execPath, args, { stdio: ["pipe", "pipe", "pipe"] });
  const exited = once(child, "exit");
  cleanup.push(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await exited;
    }
    space.remove();
  });
  const messages = [];
  createInterface({ input: child.stdout }).on("line", (line) => messages.push(JSON.parse(line)));
  let stderr = "";
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const ready = async (ms = 10000) => {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      const found = messages.find((message) => message.method === "ready");
      if (found) return found.params;
      await sleep(10);
    }
    throw new Error(`no ready in ${ms} ms; stderr: ${stderr}`);
  };
  const heard = async (pattern, ms) => {
    const deadline = Date.now() + ms;
    while (!pattern.test(stderr) && Date.now() < deadline) await sleep(20);
    return pattern.test(stderr);
  };
  return { space, ready, heard };
}

test("with --dev a built-in plugin reloads when its source changes, and files under data/ are not watched", async () => {
  const { space, ready, heard } = launch({
    "app/builtins.json": JSON.stringify({ format: 1, plugins: [{ id: "clock", root: "clock", host: "host/index.mjs" }] }),
    "app/clock/host/index.mjs": CLOCK,
    "app/clock/label.mjs": 'export const label = "1";\n',
    "data/plugins.yml": "- id: stash\n  name: ./data/stash/plugin.mjs\n",
    "data/data/stash/plugin.mjs": version("stash", "1"),
  });
  const { plugins } = await ready();
  assert.deepEqual(
    plugins.map((plugin) => [plugin.id, plugin.state, plugin.kind]),
    [
      ["clock", "running", "builtin"],
      ["stash", "running", "third-party"],
    ],
  );
  assert.ok(await heard(/clock version 1/, 2000));
  await sleep(400);
  space.write({ "app/clock/label.mjs": 'export const label = "2";\n', "data/data/stash/plugin.mjs": version("stash", "2") });
  assert.ok(await heard(/clock version 2/, 8000), "the built-in plugin did not reload");
  assert.equal(await heard(/stash version 2/, 1000), false, "a file under data/ was hot reloaded");
});
