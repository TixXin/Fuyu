import { parseArgs } from "node:util";
import { HOST_PROTOCOL, WINDOW_ORIGINS } from "../protocol.mjs";
import { blame } from "./blame.mjs";
import { startHost } from "./kernel.mjs";
import { connect } from "./rpc.mjs";
import { openWindowSocket } from "./sockets.mjs";

const FORWARDED_LOGS = new Set(["error", "warn"]);

const write = process.stdout.write.bind(process.stdout);
process.stdout.write = process.stderr.write.bind(process.stderr);

const { values } = parseArgs({
  options: {
    dir: { type: "string" },
    config: { type: "string", default: "plugins.yml" },
    watch: { type: "boolean", default: false },
    api: { type: "string", multiple: true, default: [] },
    origin: { type: "string", multiple: true, default: [] },
  },
});

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
  if (!plugin) void stop(1);
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
    watch: values.watch,
    apiNames: values.api,
    onLog: (entry) => {
      if (FORWARDED_LOGS.has(entry.type)) rpc.notify("log", entry);
    },
  });
  await host.settle();
  windows = await openWindowSocket({
    origins: values.origin.length ? values.origin : WINDOW_ORIGINS,
    snapshot: () => ({ plugins: host.status(), clients: host.clients() }),
    onCall: (method) => {
      if (method === "status") return host.status();
      throw Object.assign(new Error(`no method ${method}`), { code: "no-method" });
    },
  });
  host.watchStatus((plugins) => windows.publish("plugins", plugins));
  host.watchClients((clients) => windows.publish("clients", clients));
  rpc.notify("ready", {
    protocol: HOST_PROTOCOL,
    pid: process.pid,
    node: process.versions.node,
    plugins: host.status(),
    windows: { port: windows.port, token: windows.token },
  });
} catch (error) {
  rpc.notify("fatal", { message: String(error?.stack ?? error) });
  await stop(1);
}
