import { parseArgs } from "node:util";
import { HOST_PROTOCOL, WINDOW_ORIGINS } from "../protocol.mjs";
import { blame } from "./blame.mjs";
import { SAFE_MODES } from "./gate.mjs";
import { startHost } from "./kernel.mjs";
import { connect } from "./rpc.mjs";
import { SERVICE_CALLS } from "./services.mjs";
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
    watch: { type: "boolean", default: false },
    dev: { type: "boolean", default: false },
    safe: { type: "string" },
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
rpc.handle("stop", () => {
  setImmediate(() => stop(0));
  return true;
});

try {
  host = await startHost({
    dir: values.dir,
    config: values.config,
    builtins: values.builtins ?? null,
    watch: values.watch || values.dev,
    dev: values.dev,
    safe,
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
      if (method === "plugin.call") return host.ctx.clients.call(params?.plugin, params?.method, params?.params, window);
      if (SERVICE_CALLS.has(method)) return host.serviceHub.windowCall(method, params, window);
      throw Object.assign(new Error(`no method ${method}`), { code: "no-method" });
    },
  });
  host.watchStatus((plugins) => windows.publish("plugins", plugins), USAGE_TICK_MS);
  setInterval(() => windows.publish("host", host.info()), HOST_TICK_MS).unref();
  host.watchClients((clients) => windows.publish("clients", clients));
  host.watchServices((services) => windows.publish("services", services));
  host.serviceHub.attachWindows({ connected: () => windows.windows(), publish: (name, data) => windows.publish(name, data) });
  host.ctx.clients.onMessage((message) => windows.publish("plugin", message));
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
