#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { CSV_HEADER, MEMORY_KIND, csvRow, median, readMemory, toMB } from "./measure-memory.mjs";

export const MAIN = fileURLToPath(new URL("../../packages/plugin-base/src/host/main.mjs", import.meta.url));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function pluginsYml(count, disabled = new Set(), busy = 0) {
  let text = "";
  for (let index = 0; index < count; index += 1) {
    text += `- id: empty-${index}\n  name: ./plugins/empty-${index}.mjs\n${disabled.has(index) ? "  disabled: true\n" : ""}`;
  }
  for (let index = 0; index < busy; index += 1) text += `- id: busy-${index}\n  name: ./plugins/busy-${index}.mjs\n`;
  return text || "[]\n";
}

export function emptyPlugin(index) {
  return `export const name = "empty-${index}";\nexport function apply() {}\n`;
}

export function busyPlugin(index) {
  return `import { writeFileSync } from "node:fs";
export const name = "busy-${index}";
export function apply(ctx) {
  const recent = [];
  let ticks = 0;
  ctx.on("measure/busy", (value) => recent.push(value));
  ctx.setInterval(() => {
    ticks += 1;
    const items = Array.from({ length: 2000 }, (_, at) => ({ at, label: "item " + at, tick: ticks }));
    const copy = JSON.parse(JSON.stringify(items));
    ctx.emit("measure/busy", copy.length);
    if (recent.length > 60) recent.splice(0, recent.length - 60);
    ctx.setTimeout(() => writeFileSync(new URL("../busy-${index}.ticks", import.meta.url), String(ticks)), 10);
  }, 1000);
}
`;
}

export function makeWorkspace(count, busy = 0) {
  const dir = mkdtempSync(join(tmpdir(), "fuyu-measure-"));
  mkdirSync(join(dir, "plugins"));
  for (let index = 0; index < count; index += 1) writeFileSync(join(dir, "plugins", `empty-${index}.mjs`), emptyPlugin(index));
  for (let index = 0; index < busy; index += 1) writeFileSync(join(dir, "plugins", `busy-${index}.mjs`), busyPlugin(index));
  const busyTicks = () => Array.from({ length: busy }, (_, index) => join(dir, `busy-${index}.ticks`)).map((file) => (existsSync(file) ? Number(readFileSync(file, "utf8")) : 0));
  return { dir, busyTicks, writeConfig: (disabled) => writeFileSync(join(dir, "plugins.yml"), pluginsYml(count, disabled, busy)), remove: () => rmSync(dir, { recursive: true, force: true }) };
}

export function launch(dir, { node = process.execPath, watch = false } = {}) {
  const started = performance.now();
  const args = ["--disallow-code-generation-from-strings", MAIN, "--dir", dir, ...(watch ? ["--watch"] : [])];
  const child = spawn(node, args, { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  const waiting = new Map();
  let next = 0;
  let stderr = "";
  child.stderr.on("data", (chunk) => (stderr = (stderr + chunk).slice(-4000)));
  const exited = new Promise((resolve) => child.on("exit", (code, signal) => resolve({ code, signal, at: performance.now() })));
  const ready = new Promise((resolve, reject) => {
    createInterface({ input: child.stdout }).on("line", (line) => {
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        return;
      }
      if (message.method === "ready") resolve({ ms: performance.now() - started, params: message.params });
      if (message.method === "fatal") reject(new Error(message.params?.message));
      const pending = waiting.get(message.id);
      if (pending) {
        waiting.delete(message.id);
        pending(message);
      }
    });
    exited.then(({ code, signal }) => reject(new Error(`the host exited (${code ?? signal}) before ready: ${stderr}`)));
  });
  ready.catch(() => {});
  const call = (method, params, ms = 5000) =>
    new Promise((resolve, reject) => {
      const id = ++next;
      const timer = setTimeout(() => (waiting.delete(id), reject(new Error(`${method} timed out`))), ms);
      waiting.set(id, (message) => (clearTimeout(timer), message.error ? reject(new Error(message.error.message)) : resolve(message.result)));
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  const stop = async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.stdin.end();
    const timer = setTimeout(() => child.kill("SIGKILL"), 3000);
    await exited;
    clearTimeout(timer);
  };
  return { child, ready, exited, call, stop };
}

async function sampleMemory(pid, { settleMs, samples, everyMs }) {
  await sleep(settleMs);
  const values = [];
  for (let index = 0; index < samples; index += 1) {
    values.push(await readMemory(pid));
    if (index < samples - 1) await sleep(everyMs);
  }
  return values;
}

export async function measureStartup({ counts, rounds, settleMs, samples, everyMs, node }) {
  const results = [];
  for (const count of counts) {
    const space = makeWorkspace(count);
    space.writeConfig();
    const readyMs = [];
    const memory = [];
    try {
      for (let round = 0; round < rounds; round += 1) {
        const host = launch(space.dir, { node });
        const { ms, params } = await host.ready;
        const running = params.plugins.filter((plugin) => plugin.state === "running").length;
        if (running !== count) throw new Error(`${running} of ${count} plugins are running: ${JSON.stringify(params.plugins.slice(0, 3))}`);
        readyMs.push(ms);
        memory.push(median(await sampleMemory(host.child.pid, { settleMs, samples, everyMs })));
        await host.stop();
      }
    } finally {
      space.remove();
    }
    results.push({ plugins: count, readyMs: readyMs.map(Math.round), readyMedianMs: Math.round(median(readyMs)), memoryMB: memory.map(toMB), memoryMedianMB: toMB(median(memory)) });
  }
  return results;
}

export function nextTick(killedAt, exitAt, pollMs, phase) {
  if (!pollMs) return exitAt;
  const firstTick = killedAt + phase * pollMs;
  if (exitAt <= firstTick) return firstTick;
  return firstTick + Math.ceil((exitAt - firstTick) / pollMs) * pollMs;
}

export async function measureRestart({ count, rounds, node, pollMs }) {
  const space = makeWorkspace(count);
  space.writeConfig();
  const runs = [];
  let host = launch(space.dir, { node });
  try {
    await host.ready;
    for (let round = 0; round < rounds; round += 1) {
      await sleep(500);
      const killedAt = performance.now();
      host.child.kill("SIGKILL");
      const { at: exitAt } = await host.exited;
      const noticedAt = nextTick(killedAt, exitAt, pollMs, (round + 0.5) / rounds);
      await sleep(Math.max(0, noticedAt - performance.now()));
      host = launch(space.dir, { node });
      const { ms } = await host.ready;
      runs.push({ exitMs: Math.round(exitAt - killedAt), noticedMs: Math.round(noticedAt - killedAt), readyMs: Math.round(ms), totalMs: Math.round(performance.now() - killedAt) });
    }
  } finally {
    await host.stop();
    space.remove();
  }
  return { plugins: count, pollMs, runs, totalMedianMs: Math.round(median(runs.map((run) => run.totalMs))) };
}

export async function soak({ count, busy = 0, minutes, everyS, out, churnS, node, log = () => {} }) {
  const space = makeWorkspace(count, busy);
  space.writeConfig();
  const begun = Date.now();
  const deadline = begun + minutes * 60000;
  let restarts = 0;
  let host = launch(space.dir, { node, watch: churnS > 0 });
  let churn = null;
  let toggled = false;
  let busyTicks = [];
  writeFileSync(out, CSV_HEADER);
  try {
    await host.ready;
    if (churnS > 0 && count > 0) {
      churn = setInterval(() => {
        toggled = !toggled;
        space.writeConfig(toggled ? new Set([0]) : new Set());
      }, churnS * 1000);
    }
    for (let at = Date.now(); at <= deadline; at = Date.now()) {
      if (host.child.exitCode !== null || host.child.signalCode !== null) {
        restarts += 1;
        host = launch(space.dir, { node, watch: churnS > 0 });
        await host.ready;
      }
      let bytes = null;
      let pingMs = null;
      try {
        const sent = performance.now();
        await host.call("ping");
        pingMs = Math.round(performance.now() - sent);
        bytes = await readMemory(host.child.pid);
      } catch (error) {
        log(`sample failed: ${error.message}`);
      }
      const row = { at, elapsedS: (at - begun) / 1000, bytes, pingMs, pid: host.child.pid, restarts };
      appendFileSync(out, csvRow(row));
      log(csvRow(row).trim());
      await sleep(Math.max(0, at + everyS * 1000 - Date.now()));
    }
    busyTicks = space.busyTicks();
  } finally {
    clearInterval(churn);
    await host.stop();
    space.remove();
  }
  return { out, restarts, busyTicks };
}

const USAGE = `node scripts/plugins-v3/measure-host.mjs <startup|restart|soak> [options]
  startup  --counts 0,10,50 --rounds 5 --settle 6 --samples 5
  restart  --plugins 10 --rounds 10 --poll 1000  (0 = notice the exit at once)
  soak     --plugins 10 --busy 0 --minutes 480 --every 60 --churn 0 --out <file.csv>
  every mode: --node <path to node>`;

async function cli() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      counts: { type: "string", default: "0,10,50" },
      rounds: { type: "string" },
      settle: { type: "string", default: "6" },
      samples: { type: "string", default: "5" },
      plugins: { type: "string", default: "10" },
      busy: { type: "string", default: "0" },
      poll: { type: "string", default: "1000" },
      minutes: { type: "string", default: "480" },
      every: { type: "string", default: "60" },
      churn: { type: "string", default: "0" },
      out: { type: "string" },
      node: { type: "string", default: process.execPath },
      json: { type: "string" },
    },
  });
  const mode = positionals[0];
  const node = values.node;
  const header = { mode, platform: process.platform, arch: process.arch, memory: MEMORY_KIND[process.platform], node: execFileSync(node, ["-v"], { encoding: "utf8" }).trim(), at: new Date().toISOString() };
  let result;
  if (mode === "startup") {
    result = await measureStartup({ counts: values.counts.split(",").map(Number), rounds: Number(values.rounds ?? 5), settleMs: Number(values.settle) * 1000, samples: Number(values.samples), everyMs: 1000, node });
  } else if (mode === "restart") {
    result = await measureRestart({ count: Number(values.plugins), rounds: Number(values.rounds ?? 10), pollMs: Number(values.poll), node });
  } else if (mode === "soak") {
    const out = values.out ?? `host-soak-${Date.now()}.csv`;
    result = await soak({ count: Number(values.plugins), busy: Number(values.busy), minutes: Number(values.minutes), everyS: Number(values.every), churnS: Number(values.churn), out, node, log: (line) => process.stderr.write(`${line}\n`) });
  } else {
    process.stderr.write(`${USAGE}\n`);
    process.exit(2);
  }
  const report = { ...header, result };
  if (values.json) writeFileSync(values.json, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  cli().catch((error) => {
    process.stderr.write(`${error.stack ?? error}\n`);
    process.exit(1);
  });
}
