import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  decodeVis,
  parseIoreg,
  parseNetstat,
  parsePmset,
  parsePs,
  parseVmStat,
  programName,
} from "../../plugins/v3/official/system-monitor/src/host/mac/parse.ts";
import { rankPrograms } from "../../plugins/v3/official/system-monitor/src/host/programs.ts";
import { networkRate } from "../../plugins/v3/official/system-monitor/src/host/rates.ts";
import { History } from "../../plugins/v3/official/system-monitor/src/host/history.ts";
import { mergeConfig, parseConfigFile } from "../../plugins/v3/official/system-monitor/src/host/config.ts";
import { DEFAULT_CONFIG } from "../../plugins/v3/official/system-monitor/src/protocol.ts";
import {
  parseBattery,
  parseGpuEngines,
  parseHelperLine,
  parseNetCounters,
  parseNvidiaSmi,
  parseProcesses,
  parseThermal,
} from "../../plugins/v3/official/system-monitor/src/host/win/parse.ts";
import { HELPER_ARGS, HELPER_SCRIPT } from "../../plugins/v3/official/system-monitor/src/host/win/helperScript.ts";

const FIXTURES = fileURLToPath(new URL("../../plugins/v3/official/system-monitor/test/fixtures/", import.meta.url));
const fixture = (name) => readFileSync(FIXTURES + name, "utf8").replace(/\r\n/g, "\n");
const replies = new Map(
  fixture("windows/helper-replies.txt")
    .split("\n")
    .map(parseHelperLine)
    .filter(Boolean)
    .map((reply) => [reply.id, reply]),
);

test("vm_stat: used memory is app + wired + compressed pages, like Activity Monitor", () => {
  const memory = parseVmStat(fixture("mac/vm_stat.txt"));
  assert.equal(memory.usedBytes, (538251 - 6100 + 229422 + 530703) * 16384);
  assert.equal(parseVmStat("garbage"), null);
});

test("netstat -ibn: sums the link rows of every interface except loopback", () => {
  const counters = parseNetstat(fixture("mac/netstat-ibn.txt"));
  const lines = fixture("mac/netstat-ibn.txt").split("\n").slice(1);
  let received = 0;
  let sent = 0;
  for (const line of lines) {
    const cols = line.trim().split(/\s+/);
    if (!/^<Link#/.test(cols[2] ?? "") || cols[0].startsWith("lo")) continue;
    received += Number(cols[cols.length - 5]);
    sent += Number(cols[cols.length - 2]);
  }
  assert.ok(received > 79_000_000_000, "en0 bytes must be counted");
  assert.deepEqual(counters, { received, sent });
  assert.equal(parseNetstat("nothing here"), null);
});

test("network rate: bytes per second between two readings, never negative", () => {
  assert.equal(networkRate(null, { at: 0, received: 1, sent: 1 }), null);
  assert.deepEqual(networkRate({ at: 1000, received: 1000, sent: 500 }, { at: 3000, received: 5000, sent: 300 }), {
    downBytesPerSec: 2000,
    upBytesPerSec: 0,
  });
});

test("pmset: battery percent, charging and power source; no battery on a desktop", () => {
  assert.deepEqual(parsePmset(fixture("mac/pmset-ac.txt")).battery, { percent: 80, charging: false, pluggedIn: true });
  assert.deepEqual(parsePmset(fixture("mac/pmset-battery.txt")).battery, { percent: 57, charging: false, pluggedIn: false });
  assert.deepEqual(parsePmset(fixture("mac/pmset-charging.txt")).battery, { percent: 64, charging: true, pluggedIn: true });
  assert.equal(parsePmset(fixture("mac/pmset-desktop.txt")).battery, null);
});

test("ps: program names come from the outermost .app, non-ASCII names are decoded, CPU is a share of the machine", () => {
  assert.equal(decodeVis("M-fM-1M-=M-fM-0M-4M-iM^_M-3M-dM-9M^P"), "汽水音乐");
  assert.equal(decodeVis("M-Audio"), "M-Audio");
  assert.equal(programName("/Applications/QQ.app/Contents/Frameworks/QQ Helper (Renderer).app/Contents/MacOS/QQ Helper (Renderer)"), "QQ");
  assert.equal(programName("/usr/libexec/logd"), "logd");
  const rows = parsePs(fixture("mac/ps.txt"), 10);
  const window = rows.find((row) => row.name === "WindowServer");
  assert.equal(window.cpuPercent, 3.88);
  assert.equal(window.memoryBytes, 110288 * 1024);
  const ranked = rankPrograms(rows);
  const music = ranked.byCpu.find((program) => program.name === "汽水音乐");
  assert.equal(music.count, 3);
  assert.equal(music.cpuPercent, 1.2);
  assert.equal(ranked.byMemory.find((program) => program.name === "QQ").count, 3);
  assert.equal(ranked.byCpu[0].name, "WindowServer");
});

test("ioreg: Apple GPU utilisation and memory in use", () => {
  assert.deepEqual(parseIoreg(fixture("mac/ioreg-accelerator.txt")), {
    name: "Apple M4",
    percent: 51,
    memoryUsedBytes: 709558272,
  });
  assert.equal(parseIoreg(""), null);
});

test("rankPrograms merges processes by name and keeps the top entries of each order", () => {
  const ranked = rankPrograms(
    [
      { name: "a", cpuPercent: 1, memoryBytes: 10 },
      { name: "a", cpuPercent: 2, memoryBytes: 10 },
      { name: "b", cpuPercent: 0.5, memoryBytes: 100 },
      { name: "c", cpuPercent: 9, memoryBytes: 1 },
    ],
    2,
  );
  assert.deepEqual(ranked.byCpu.map((p) => p.name), ["c", "a"]);
  assert.deepEqual(ranked.byMemory.map((p) => p.name), ["b", "a"]);
  assert.deepEqual(ranked.byCpu[1], { name: "a", count: 2, cpuPercent: 3, memoryBytes: 20 });
});

test("helper replies: network, battery status codes, thermal zones in tenths of kelvin", () => {
  assert.deepEqual(parseNetCounters(replies.get(2).data), { received: 98234117, sent: 1520331 });
  assert.deepEqual(parseBattery(replies.get(3).data), { percent: 87, charging: false, pluggedIn: true });
  assert.deepEqual(parseBattery({ present: true, status: 7, percent: 40 }), { percent: 40, charging: true, pluggedIn: true });
  assert.deepEqual(parseBattery({ present: true, status: 1, percent: 40 }), { percent: 40, charging: false, pluggedIn: false });
  assert.equal(parseBattery(replies.get(4).data), null);
  assert.equal(parseThermal(replies.get(5).data), 40.1);
  assert.equal(parseThermal(replies.get(6).data), null);
  assert.equal(replies.get(12).ok, false);
  assert.match(replies.get(12).error, /Invalid class/);
  assert.equal(parseHelperLine("WARNING: something"), null);
});

test("helper processes: CPU from the change in kernel + user time across all cores, first scan has none", () => {
  const first = parseProcesses(replies.get(7).data, null, 10_000, 4);
  assert.equal(first.rows, null);
  const second = parseProcesses(replies.get(8).data, first.times, 11_000, 4);
  const ranked = rankPrograms(second.rows);
  assert.deepEqual(ranked.byCpu[0], { name: "System", count: 1, cpuPercent: 25, memoryBytes: 155648 });
  assert.deepEqual(ranked.byCpu[1], { name: "chrome", count: 2, cpuPercent: 7.5, memoryBytes: 314572800 });
  assert.equal(ranked.byCpu.find((p) => p.name === "notepad").cpuPercent, 0);
  assert.equal(ranked.byMemory[0].name, "chrome");
  const wrapped = parseProcesses(replies.get(13).data, null, 0, 1);
  assert.equal(wrapped.times.times.get(4), 1);
});

test("nvidia-smi: name, load, temperature, memory in MiB, power; [N/A] stays empty", () => {
  assert.deepEqual(parseNvidiaSmi(fixture("windows/nvidia-smi.txt")), {
    name: "NVIDIA GeForce RTX 3060",
    percent: 37,
    temperatureC: 54,
    memoryUsedBytes: 2148 * 1024 * 1024,
    memoryTotalBytes: 12288 * 1024 * 1024,
    powerW: 31.42,
  });
  assert.equal(parseNvidiaSmi(fixture("windows/nvidia-smi-laptop.txt")).powerW, null);
  assert.equal(parseNvidiaSmi(""), null);
});

test("GPU engine counters: the adapter with the most dedicated memory, each type as busy as its busiest engine", () => {
  assert.deepEqual(parseGpuEngines(replies.get(9).data), {
    name: "NVIDIA GeForce RTX 3060",
    percent: 42,
    memoryUsedBytes: 2252341248,
    engines: [
      { id: "3d", percent: 42 },
      { id: "copy", percent: 3 },
      { id: "decode", percent: 12 },
      { id: "encode", percent: 0 },
    ],
  });
  assert.equal(parseGpuEngines(replies.get(10).data), "pending");
  assert.equal(parseGpuEngines(replies.get(11).data), null);
});

test("the helper script fits on a Windows command line and answers every request the host sends", () => {
  const encoded = HELPER_ARGS[HELPER_ARGS.length - 1];
  assert.ok(HELPER_ARGS.join(" ").length < 30_000, `command line is ${HELPER_ARGS.join(" ").length} characters`);
  assert.equal(Buffer.from(encoded, "base64").toString("utf16le"), HELPER_SCRIPT);
  assert.match(HELPER_SCRIPT, /^[\x09\x0a\x0d\x20-\x7e]*$/, "the script must stay ASCII");
  for (const kind of ["net", "battery", "thermal", "procs", "gpu", "icons", "taskmgr"]) {
    assert.match(HELPER_SCRIPT, new RegExp(`'${kind}' \\{`), `missing request ${kind}`);
  }
});

test("config: old config.json keeps its values and gets the new defaults; bad values are ignored", () => {
  const old = parseConfigFile(JSON.stringify({ intervalMs: 5000, showOnBar: false, barCpu: true, barMemory: false, locale: "en" }));
  assert.deepEqual(old, { ...DEFAULT_CONFIG, intervalMs: 5000, showOnBar: false, barMemory: false, locale: "en" });
  assert.deepEqual(parseConfigFile("{not json"), DEFAULT_CONFIG);
  const next = mergeConfig(old, { layout: "double", backgroundHistory: true, intervalMs: 999999, barCpu: "yes", locale: "fr" });
  assert.equal(next.layout, "double");
  assert.equal(next.backgroundHistory, true);
  assert.equal(next.intervalMs, 10000);
  assert.equal(next.barCpu, true);
  assert.equal(next.locale, "en");
  assert.equal(mergeConfig(old, { layout: "wide" }).layout, "auto");
});

test("history keeps five minutes and at most 300 points", () => {
  const history = new History(5 * 60_000, 300);
  for (let i = 0; i < 400; i += 1) history.add({ at: i * 1000, cpu: i, gpu: null, down: null, up: null });
  const snapshot = history.snapshot(399_000);
  assert.equal(snapshot.points.length, 300);
  assert.equal(snapshot.points[0].at, 100_000);
  assert.equal(history.snapshot(800_000).points.length, 0);
});
