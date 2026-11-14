import { parseArgs } from "node:util";
import { startHost } from "./kernel.mjs";
import { connect } from "./rpc.mjs";

const PROTOCOL = 1;
const FORWARDED_LOGS = new Set(["error", "warn"]);

const write = process.stdout.write.bind(process.stdout);
process.stdout.write = process.stderr.write.bind(process.stderr);

const { values } = parseArgs({
  options: {
    dir: { type: "string" },
    config: { type: "string", default: "plugins.yml" },
    watch: { type: "boolean", default: false },
    api: { type: "string", multiple: true, default: [] },
  },
});

let host = null;
let stopping = null;

function stop(code) {
  stopping ??= (async () => {
    try {
      await host?.stop();
    } finally {
      process.exit(code);
    }
  })();
  return stopping;
}

const rpc = connect({ input: process.stdin, write, onClose: () => stop(0) });
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
  rpc.notify("ready", { protocol: PROTOCOL, pid: process.pid, node: process.versions.node, plugins: host.status() });
} catch (error) {
  rpc.notify("fatal", { message: String(error?.stack ?? error) });
  await stop(1);
}
