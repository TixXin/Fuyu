import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { encodedCommand, followJob, jobScript, SSH } from "./remote.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { host, root, id } = JSON.parse(process.argv[2]);
const body = readFileSync(path.join(HERE, "remote-job.ps1"), "utf8");
let child = null;
let stop = false;

function call(step, extra = {}, forward = false) {
  return new Promise((resolve) => {
    const script = encodedCommand(jobScript({ step, root, id, ...extra }, body));
    child = spawn("ssh", ["-n", ...SSH, host, script], { stdio: ["ignore", "pipe", forward ? "inherit" : "ignore"] });
    let bytes = 0;
    let text = "";
    child.stdout.on("data", (chunk) => {
      bytes += chunk.length;
      if (forward) process.stdout.write(chunk);
      else text += chunk.toString("utf8");
    });
    child.on("error", () => resolve({ code: 255, bytes, text }));
    child.on("close", (code) => resolve({ code: code ?? 255, bytes, text }));
  });
}

function onSignal() {
  stop = true;
  child?.kill();
}
process.on("SIGINT", onSignal);
process.on("SIGTERM", onSignal);

const code = await followJob({
  follow: (offset) => call("follow", { offset }, true),
  status: async () => {
    const result = await call("status");
    if (result.code !== 0) return null;
    try {
      return JSON.parse(result.text.trim().split("\n").pop());
    } catch {
      return null;
    }
  },
  cancel: () => call("cancel"),
  stopped: () => stop,
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  host,
  where: `${host}:${root}/out/${id}.log`,
});
process.exit(code);
