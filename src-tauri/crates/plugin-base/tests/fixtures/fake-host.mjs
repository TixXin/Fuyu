import { createInterface } from "node:readline";

const mode = process.env.FAKE_HOST_MODE ?? "ok";
const send = (message) => process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);

if (mode === "exit-at-once") process.exit(3);

let hanging = false;
let asked = 0;
let dying = null;
const asking = new Map();
createInterface({ input: process.stdin })
  .on("line", (line) => {
    const message = JSON.parse(line);
    if (hanging) return;
    if (message.method === "progress" && message.params?.id === dying) process.exit(6);
    if (message.method === undefined && asking.has(message.id)) {
      const original = asking.get(message.id);
      asking.delete(message.id);
      send({ id: original, result: message.error ? { error: message.error } : { result: message.result } });
    }
    if (message.method === "ask") {
      const id = `h-${++asked}`;
      asking.set(id, message.id);
      send({ id, method: message.params.method, params: message.params.params ?? null });
    }
    if (message.method === "ask-then-die") {
      dying = `h-${++asked}`;
      send({ id: dying, method: message.params.method, params: message.params.params ?? null });
    }
    if (message.method === "ping") send({ id: message.id, result: { at: Date.now() } });
    if (message.method === "who") send({ id: message.id, result: { pid: process.pid } });
    if (message.method === "stop") {
      send({ id: message.id, result: true });
      setImmediate(() => process.exit(0));
    }
    if (message.method === "die") process.exit(5);
    if (message.method === "hang") {
      send({ id: message.id, result: true });
      hanging = true;
    }
  })
  .on("close", () => process.exit(0));

process.stderr.write("fake host started\n");
const delay = mode === "slow-ready" ? 60000 : 0;
setTimeout(() => send({ method: "ready", params: { protocol: Number(process.env.FAKE_HOST_PROTOCOL ?? 2), pid: process.pid, mode } }), delay);
setInterval(() => {}, 1000);
