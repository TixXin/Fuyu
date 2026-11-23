import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { downloadCiBuild } from "../../scripts/release/ci-build.mjs";
import { clockText, createClock, sizeText } from "../../scripts/release/timing.mjs";

function fakeTime(...times) {
  return () => times.shift();
}

test("every ✓ line carries the time since the start and each stage is the time since the previous one", () => {
  const said = [];
  const clock = createClock({ now: fakeTime(0, 12_000, 12_000, 200_000, 260_400, 261_000, 261_000), log: (line) => said.push(line) });
  clock.done("checks", "Ready.");
  assert.equal(clock.stamp(), "[+0:12]");
  clock.done("Windows build", "Finished.");
  clock.mark("issue comments");
  assert.deepEqual(said, ["✓ [+0:12] Ready.", "✓ [+3:20] Finished."]);
  assert.deepEqual(clock.stages().map(({ stage, ms }) => [stage, ms]), [["checks", 12_000], ["Windows build", 188_000], ["issue comments", 60_400]]);
  assert.deepEqual(clock.table(), [
    "",
    "Time per stage:",
    "  checks            0:12",
    "  Windows build     3:08",
    "  issue comments    1:00",
    "  total             4:21",
  ]);
});

test("a run that stops before any stage prints no table, and sizes read as speeds", () => {
  assert.deepEqual(createClock({ log: () => {} }).table(), []);
  assert.equal(clockText(59_499), "0:59");
  assert.equal(clockText(3_725_000), "62:05");
  assert.equal(sizeText(52_533_943, 39_000), "52.5 MB in 0:39 (1.3 MB/s)");
});

test("waiting for the CI run and downloading it are separate stages, and a failed download is tried three times", () => {
  const dir = mkdtempSync(join(tmpdir(), "fuyu-ci-download-"));
  try {
    writeFileSync(join(dir, "old.bin"), Buffer.alloc(5_000_000));
    const said = [];
    const clock = createClock({ now: fakeTime(0, 300_000, 300_000, 340_000), log: (line) => said.push(line) });
    const calls = [];
    const run = (command, args) => {
      calls.push(args.slice(0, 2).join(" "));
      if (args[1] === "download") {
        mkdirSync(join(dir, "bundle", "nsis"), { recursive: true });
        writeFileSync(join(dir, "bundle", "nsis", "setup.exe"), Buffer.alloc(20_000_000));
      }
      return { status: 0, stdout: "", stderr: "" };
    };
    const problem = downloadCiBuild(run, { workflow: "release-windows.yml", label: "Windows", repo: "o/r", artifact: "a", runId: 7, dir, clock, wait: () => {}, now: fakeTime(100_000, 140_000), onBuilt: (found) => calls.push(`built ${found.databaseId}`) });
    assert.equal(problem, null);
    assert.deepEqual(calls, ["run watch", "built 7", "run download"]);
    assert.deepEqual(clock.stages().map(({ stage, ms }) => [stage, ms]), [["Windows build", 300_000], ["Windows download", 40_000]]);
    assert.match(said.join("\n"), /The Windows build finished/);

    const failing = (command, args) => ({ status: args[1] === "download" ? 1 : 0, stdout: "", stderr: "HTTP 500" });
    const waits = [];
    const failed = downloadCiBuild(failing, { workflow: "w", label: "macOS", repo: "o/r", artifact: "a", runId: 8, dir, clock: createClock({ log: () => {} }), wait: (ms) => waits.push(ms) });
    assert.match(failed, /could not download the macOS build: HTTP 500/);
    assert.deepEqual(waits, [10_000, 10_000]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the download stage reports the size and speed of the new files only", () => {
  const dir = mkdtempSync(join(tmpdir(), "fuyu-ci-download-"));
  try {
    writeFileSync(join(dir, "old.bin"), Buffer.alloc(5_000_000));
    const said = [];
    const clock = createClock({ now: fakeTime(0, 1_000, 1_000, 41_000), log: (line) => said.push(line) });
    const run = (command, args) => {
      if (args[1] === "download") writeFileSync(join(dir, "setup.exe"), Buffer.alloc(20_000_000));
      return { status: 0, stdout: "", stderr: "" };
    };
    downloadCiBuild(run, { workflow: "w", label: "Windows", repo: "o/r", artifact: "a", runId: 7, dir, clock, now: fakeTime(1_000, 41_000) });
    assert.deepEqual(clock.stages().map(({ stage, ms }) => [stage, ms]), [["Windows build", 1_000], ["Windows download", 40_000]]);
    assert.match(said[1], /^✓ \[\+0:41\] Downloaded the Windows build: 20\.0 MB in 0:40 \(0\.5 MB\/s\)\.$/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
