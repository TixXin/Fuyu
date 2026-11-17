import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";
import WebSocket from "ws";
import { connectHost, createBridge, createLoader, createServiceProxy, createSlots, createWindowServices } from "@fuyu/plugin-base/client";
import { notesV1 } from "./services.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const HOST_MAIN = fileURLToPath(new URL("../../src/host/main.mjs", import.meta.url));
const BUILTINS_DIR = join(HERE, "builtins");
const WORD_COUNT_DIR = join(HERE, "plugins", "word-count");
const ORIGIN = "tauri://localhost";

function waitFor(predicate, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const step = () => {
      try {
        const value = predicate();
        if (value) return resolve(value);
      } catch (error) {
        return reject(error);
      }
      if (Date.now() >= deadline) return reject(new Error("timed out waiting for condition"));
      setTimeout(step, 20);
    };
    step();
  });
}

function startShellAndHost(dataDir) {
  const store = [{ id: 1, text: "hello world" }];
  const child = spawn(
    process.execPath,
    ["--disallow-code-generation-from-strings", HOST_MAIN, "--dir", dataDir, "--builtins", BUILTINS_DIR, "--watch"],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  const messages = [];
  const send = (payload) => child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", ...payload })}\n`);
  createInterface({ input: child.stdout }).on("line", (line) => {
    const message = JSON.parse(line);
    messages.push(message);
    if (message.id === undefined) return;
    if (message.method === "storage.read") {
      send({ id: message.id, result: store });
      return;
    }
    if (message.method === "storage.write") {
      const note = { id: store.length + 1, text: String(message.params?.text ?? "") };
      store.push(note);
      send({ id: message.id, result: note });
      return;
    }
    send({ id: message.id, error: { code: "no-method", message: `no shell method ${message.method}` } });
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const exited = new Promise((resolve) => child.on("exit", (code) => resolve(code)));
  return { child, messages, send, exited, store, stderr: () => stderr };
}

function resolveClientFile(url) {
  const path = new URL(url).pathname.replace(/^\/+/, "");
  if (path.startsWith("dev/word-count/")) {
    return join(WORD_COUNT_DIR, path.slice("dev/word-count/".length));
  }
  throw new Error(`unmapped client asset: ${path}`);
}

export async function runMinimalApp() {
  const dataDir = mkdtempSync(join(tmpdir(), "plugin-base-minimal-app-"));
  const writeConfig = (disabled = false) => {
    const lines = [
      "- id: word-count",
      "  source: dev",
      `  path: ${JSON.stringify(WORD_COUNT_DIR)}`,
      ...(disabled ? ["  disabled: true"] : []),
      "",
    ];
    writeFileSync(join(dataDir, "plugins.yml"), lines.join("\n"));
  };
  writeConfig(false);
  const shell = startShellAndHost(dataDir);
  let connection = null;
  let loader = null;
  try {
    const ready = await waitFor(() => shell.messages.find((item) => item.method === "ready"));
    const target = ready.params.windows;
    const registry = createSlots({ "main.panel/v1": { kind: "list", perPlugin: 2 } });
    const bridge = createBridge((method, params) => connection.call(method, params));
    const proxy = createServiceProxy((method, params, options) => connection.call(method, params, options));
    const windowServices = createWindowServices({ remote: proxy });
    loader = createLoader({
      registry,
      bridge,
      base: "app-plugin://localhost",
      checkFile: async (url) => {
        statSync(resolveClientFile(url));
      },
      importModule: (url) => import(pathToFileURL(resolveClientFile(url)).href),
    });
    const pluginMessages = [];
    bridge.subscribe((message) => pluginMessages.push(message));
    let latestClients = [];
    let latestPlugins = ready.params.plugins;
    connection = connectHost({
      resolve: async () => target,
      window: "main",
      open: (url) => new WebSocket(url, { origin: ORIGIN }),
      onSnapshot: (snapshot) => {
        latestPlugins = snapshot.plugins;
        latestClients = snapshot.clients.filter((entry) => entry.window === "main");
        proxy.update(snapshot.services);
        void proxy.resubscribe();
      },
      onEvent: (name, data) => {
        if (name === "plugins") latestPlugins = data;
        if (name === "clients") latestClients = data.filter((entry) => entry.window === "main");
        if (name === "services") proxy.update(data);
        if (name === "service") proxy.deliver(data);
        if (name === "plugin") bridge.deliver(data);
      },
    });
    await waitFor(() => connection.state === "open" && latestClients.length === 1);
    await loader.sync(latestClients);
    const itemsBefore = registry.items("main.panel/v1");
    const renderedBefore = await itemsBefore[0].component();
    const notesClient = windowServices.get(notesV1);
    const heardNotes = [];
    const offAdded = notesClient.on("added", (note) => heardNotes.push(note));
    const added = await notesClient.add({ text: "plugin base works" });
    await waitFor(() => heardNotes.length === 1 && pluginMessages.length === 1);
    const renderedAfter = await itemsBefore[0].component();
    const allNotes = await notesClient.list({});
    await offAdded();
    writeConfig(true);
    await waitFor(() => latestPlugins.find((item) => item.id === "word-count")?.state === "disabled" && latestClients.length === 0);
    await loader.sync(latestClients);
    const itemsAfterDisable = registry.items("main.panel/v1");
    connection.close();
    connection = null;
    await loader.stop();
    loader = null;
    shell.send({ id: 99, method: "stop" });
    const exitCode = await shell.exited;
    return {
      protocol: ready.params.protocol,
      initialPanel: renderedBefore,
      addedNote: added,
      updatedPanel: renderedAfter,
      allNotes,
      heardNotes,
      pluginMessages,
      slotsAfterDisable: itemsAfterDisable.length,
      exitCode,
    };
  } finally {
    connection?.close();
    await loader?.stop();
    shell.child.kill();
    rmSync(dataDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = await runMinimalApp();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
