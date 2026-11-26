import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import { config, workspace } from "./workspace.mjs";

const MAIN = fileURLToPath(new URL("../src/host/main.mjs", import.meta.url));
const cleanup = [];
after(() => cleanup.forEach((step) => step()));

async function connectIsland() {
  const { default: WebSocket } = await import("ws");
  const { connectHost } = await import("@fuyu/plugin-base/client");
  const space = workspace({ "plugins.yml": config([{ id: "weather", name: "./weather.mjs" }]), "weather.mjs": 'export const name = "weather";\nexport function apply() {}\n' });
  cleanup.push(space.remove);
  const child = spawn(process.execPath, [MAIN, "--dir", space.dir], { stdio: ["pipe", "pipe", "inherit"] });
  cleanup.push(() => child.kill());
  const ready = await new Promise((resolve) => {
    createInterface({ input: child.stdout }).on("line", (line) => {
      const message = JSON.parse(line);
      if (message.method === "ready") resolve(message.params);
    });
  });
  const events = [];
  const connection = connectHost({
    resolve: async () => ready.windows,
    window: "island",
    open: (url) => new WebSocket(url, { origin: "tauri://localhost" }),
    onEvent: (name, data) => events.push({ name, data }),
  });
  cleanup.push(() => connection.close());
  const deadline = Date.now() + 5000;
  while (connection.state !== "open" && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
  return { connection, events };
}

const until = async (check) => {
  const deadline = Date.now() + 5000;
  while (!check() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
  return check();
};

test("the host's main process routes the island and settings window calls to Fuyu's extensions", async () => {
  const { connection, events } = await connectIsland();
  await connection.call("settings.setup", { plugin: "weather", needed: true, hint: "Pick a city" });
  const status = await connection.call("status");
  assert.deepEqual(status.find((item) => item.id === "weather").setup, { hint: "Pick a city" });
  const opened = connection.call("island.open", { plugin: "weather", page: "forecast" });
  assert.ok(await until(() => events.some((event) => event.name === "island.request")));
  const request = events.find((event) => event.name === "island.request").data;
  assert.deepEqual({ ...request, id: undefined }, { id: undefined, action: "open", plugin: "weather", page: "forecast" });
  assert.equal(await connection.call("island.result", { id: request.id, value: null }), true);
  assert.equal(await opened, null);
  await assert.rejects(connection.call("island.nothing"), (error) => error.code === "no-method");
});
