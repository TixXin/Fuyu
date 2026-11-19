import { parseArgs } from "node:util";
import { HOST_PROTOCOL, SERVICE_CALLS, WINDOW_ORIGINS } from "../protocol.mjs";
import { blame } from "./blame.mjs";
import { SAFE_MODES } from "./gate.mjs";
import { startHost } from "./kernel.mjs";
import { connect, RpcError } from "./rpc.mjs";
import { openWindowSocket } from "./sockets.mjs";

const FORWARDED_LOGS = new Set(["error", "warn"]);
const USAGE_TICK_MS = 2000;
const HOST_TICK_MS = 5000;

const write = process.stdout.write.bind(process.stdout);
process.stdout.write = process.stderr.write.bind(process.stderr);

const { values } = parseArgs({
  options: {
    dir: { type: "string" },
    config: { type: "string", default: "plugins.yml" },
    builtins: { type: "string" },
    "app-version": { type: "string" },
    watch: { type: "boolean", default: false },
    dev: { type: "boolean", default: false },
    safe: { type: "string" },
    bisect: { type: "string", multiple: true, default: [] },
    api: { type: "string", multiple: true, default: [] },
    origin: { type: "string", multiple: true, default: [] },
  },
});

const safe = values.safe && Object.hasOwn(SAFE_MODES, values.safe) ? values.safe : null;
if (values.safe && !safe) process.stderr.write(`unknown safe mode ${values.safe}; starting every plugin\n`);

let host = null;
let windows = null;
let stopping = null;

function stop(code) {
  stopping ??= (async () => {
    try {
      await windows?.close();
      await host?.stop();
    } finally {
      process.exit(code);
    }
  })();
  return stopping;
}

const rpc = connect({ input: process.stdin, write, onClose: () => stop(0) });

function stray(kind, error) {
  const plugin = host ? blame(host.ctx, error) : null;
  const entry = { at: Date.now(), type: "error", name: plugin ?? "host", plugin, text: `${kind} ${plugin ? `in plugin ${plugin}` : "outside any plugin"}: ${String(error?.stack ?? error)}` };
  host?.logs.push(entry);
  rpc.notify("log", entry);
  if (!plugin) return void stop(1);
  host.fault(plugin, error);
}

process.on("uncaughtException", (error) => stray("uncaught exception", error));
process.on("unhandledRejection", (reason) => stray("unhandled rejection", reason));
rpc.handle("ping", (params) => ({ at: Date.now(), echo: params ?? null }));
rpc.handle("status", () => host?.status() ?? []);
rpc.handle("bisect", (params) => {
  if (!host) throw new RpcError("not-ready", "the plugin host has not loaded its plugins yet");
  return host.bisect(params?.off);
});
rpc.handle("stop", () => {
  setImmediate(() => stop(0));
  return true;
});

try {
  host = await startHost({
    dir: values.dir,
    config: values.config,
    builtins: values.builtins ?? null,
    appVersion: values["app-version"] ?? null,
    watch: values.watch || values.dev,
    dev: values.dev,
    safe,
    bisect: values.bisect.filter(Boolean),
    apiNames: values.api,
    rpc,
    onLog: (entry) => {
      if (FORWARDED_LOGS.has(entry.type)) rpc.notify("log", entry);
    },
  });
  await host.settle();
  windows = await openWindowSocket({
    origins: values.origin.length ? values.origin : WINDOW_ORIGINS,
    snapshot: () => ({ plugins: host.status(), clients: host.clients(), services: host.services(), host: host.info() }),
    onCall: (method, params, window) => {
      if (method === "status") return host.status();
      if (method === "host") return host.info();
      if (method === "bisect") return host.bisect(params?.off);
      if (method === "plugin.call") return host.ctx.clients.call(params?.plugin, params?.method, params?.params, window);
      if (method === "island.open" || method === "island.collapse") return host.islandControl.request(method.slice("island.".length), params?.plugin, params?.page);
      if (method === "island.result") return host.islandControl.settle(params, window);
      if (SERVICE_CALLS.includes(method)) return host.serviceHub.windowCall(method, params, window);
      throw Object.assign(new Error(`no method ${method}`), { code: "no-method" });
    },
  });
  host.watchStatus((plugins) => windows.publish("plugins", plugins), USAGE_TICK_MS);
  setInterval(() => windows.publish("host", host.info()), HOST_TICK_MS).unref();
  const tellRust = (clients) => rpc.notify("clients", { paths: [...new Set(clients.map((entry) => entry.path))], roots: host.clientRoots(clients) });
  host.watchClients((clients) => {
    tellRust(clients);
    windows.publish("clients", clients);
  });
  host.watchServices((services) => windows.publish("services", services));
  host.serviceHub.attachWindows({ connected: () => windows.windows(), publish: (name, data) => windows.publish(name, data) });
  host.settingsOpener.attachWindows({ connected: () => windows.windows(), publish: (name, data) => windows.publish(name, data) });
  host.islandControl.attachWindows({ connected: () => windows.windows(), publish: (name, data) => windows.publish(name, data) });
  host.ctx.clients.onMessage((message) => windows.publish("plugin", message));
  tellRust(host.clients());
  rpc.notify("ready", {
    protocol: HOST_PROTOCOL,
    pid: process.pid,
    node: process.versions.node,
    plugins: host.status(),
    safe,
    windows: { port: windows.port, token: windows.token },
  });
} catch (error) {
  rpc.notify("fatal", { message: String(error?.stack ?? error) });
  await stop(1);
}
