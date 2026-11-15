import { createInterface } from "node:readline";

const mode = process.env.FAKE_HOST_MODE ?? "ok";
const send = (message) => process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);

if (mode === "exit-at-once") process.exit(3);

let hanging = false;
createInterface({ input: process.stdin })
  .on("line", (line) => {
    const message = JSON.parse(line);
    if (hanging) return;
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
setTimeout(() => send({ method: "ready", params: { pid: process.pid, mode } }), delay);
setInterval(() => {}, 1000);
