import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { measureRestart, measureStartup, nextTick, pluginsYml, soak } from "../../scripts/plugins-v3/measure-host.mjs";
import { CSV_HEADER, csvRow, median, parseBytes, parseFootprint, parseLinuxStatus, toMB } from "../../scripts/plugins-v3/measure-memory.mjs";

test("memory readings are parsed from footprint, PowerShell and /proc", () => {
  assert.equal(parseFootprint("Auxiliary data:\n    phys_footprint: 12126008 B\n    phys_footprint_peak: 12126008 B\n"), 12126008);
  assert.throws(() => parseFootprint("Footprint: 12 MB"), /no phys_footprint/);
  assert.equal(parseBytes("28672000\r\n"), 28672000);
  assert.throws(() => parseBytes(""), /not a byte count/);
  assert.equal(parseLinuxStatus("Name:\tnode\nVmRSS:\t   30000 kB\n"), 30000 * 1024);
});

test("medians, megabytes and CSV rows come out as the report expects", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(median([]), null);
  assert.equal(toMB(28 * 1048576 + 104858), 28.1);
  assert.equal(CSV_HEADER, "at,elapsed_s,memory_mb,ping_ms,host_pid,restarts\n");
  assert.equal(csvRow({ at: 0, elapsedS: 60.4, bytes: 1048576, pingMs: 1, pid: 42, restarts: 0 }), "1970-01-01T00:00:00.000Z,60,1,1,42,0\n");
  assert.equal(csvRow({ at: 0, elapsedS: 0, bytes: null, pingMs: null, pid: 42, restarts: 1 }), "1970-01-01T00:00:00.000Z,0,,,42,1\n");
});

test("the configuration lists one empty plugin per slot and can disable some", () => {
  assert.equal(pluginsYml(0), "[]\n");
  assert.equal(pluginsYml(2, new Set([1])), "- id: empty-0\n  name: ./plugins/empty-0.mjs\n- id: empty-1\n  name: ./plugins/empty-1.mjs\n  disabled: true\n");
});

test("a supervisor that polls notices an exit at its next tick, and at once without polling", () => {
  assert.equal(nextTick(0, 5, 0, 0.5), 5);
  assert.equal(nextTick(0, 5, 1000, 0.25), 250);
  assert.equal(nextTick(0, 300, 1000, 0.25), 1250);
});

test("startup, restart and soak each run against the real host", async () => {
  const [empty, two] = await measureStartup({ counts: [0, 2], rounds: 1, settleMs: 0, samples: 1, everyMs: 0, node: process.execPath });
  assert.equal(empty.plugins, 0);
  assert.equal(two.plugins, 2);
  assert.ok(two.readyMedianMs > 0 && two.memoryMedianMB > 5, JSON.stringify(two));
  const restart = await measureRestart({ count: 1, rounds: 1, pollMs: 0, node: process.execPath });
  assert.equal(restart.runs.length, 1);
  assert.ok(restart.runs[0].totalMs >= restart.runs[0].readyMs);
  const dir = mkdtempSync(join(tmpdir(), "measure-soak-"));
  try {
    const out = join(dir, "soak.csv");
    await soak({ count: 1, minutes: 0.02, everyS: 0.5, churnS: 0, out, node: process.execPath });
    const rows = readFileSync(out, "utf8").trim().split("\n");
    assert.equal(rows[0], CSV_HEADER.trim());
    assert.ok(rows.length >= 3, rows.join("\n"));
    assert.match(rows[1], /^\d{4}-\d\d-\d\dT[^,]+,0,[\d.]+,\d+,\d+,0$/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
