import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fetchRunning, fileHashes, pendingPlatforms, prefetch, prefetchDir, startPrefetch, takePrefetched } from "../../scripts/release/prefetch.mjs";

const record = { version: "0.3.13-beta.1", windows: 11, mac: 12 };

function put(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

function downloaded(root, platform, files, manifest = {}) {
  const base = prefetchDir(record, root);
  mkdirSync(join(base, platform), { recursive: true });
  for (const [name, text] of Object.entries(files)) put(join(base, platform, name), text);
  const entry = { platform, runId: record[platform], version: record.version, files: fileHashes(join(base, platform)), stages: [], ...manifest };
  put(join(base, `${platform}.json`), JSON.stringify(entry));
  return base;
}

test("a build downloaded ahead replaces the old installers in the release folder and keeps everything else", () => {
  const root = mkdtempSync(join(tmpdir(), "fuyu-prefetch-"));
  try {
    downloaded(root, "windows", { "bundle/nsis/Fuyu_0.3.13-beta.1_x64-setup.exe": "new", "bundle/nsis/Fuyu_0.3.13-beta.1_x64-setup.exe.sig": "sig", "fuyu.exe": "exe" });
    const dest = join(root, "release");
    put(join(dest, "bundle", "nsis", "Fuyu_0.3.12_x64-setup.exe"), "old");
    put(join(dest, "beta-channel", "latest.json"), "{}");
    const taken = takePrefetched("windows", { record, version: record.version, dest, root });
    assert.equal(taken.problem, undefined);
    assert.equal(readFileSync(join(dest, "bundle", "nsis", "Fuyu_0.3.13-beta.1_x64-setup.exe.sig"), "utf8"), "sig");
    assert.equal(readFileSync(join(dest, "fuyu.exe"), "utf8"), "exe");
    assert.equal(existsSync(join(dest, "bundle", "nsis", "Fuyu_0.3.12_x64-setup.exe")), false, "an older installer would be uploaded with this version");
    assert.equal(existsSync(join(dest, "beta-channel", "latest.json")), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("pnpm release downloads again when the files ahead changed, failed or belong to another build", () => {
  const root = mkdtempSync(join(tmpdir(), "fuyu-prefetch-"));
  try {
    const base = downloaded(root, "mac", { "Fuyu_0.3.13-beta.1_aarch64.dmg": "dmg" });
    writeFileSync(join(base, "mac", "Fuyu_0.3.13-beta.1_aarch64.dmg"), "tampered");
    const dest = join(root, "macos");
    put(join(dest, "keep.txt"), "x");
    assert.match(takePrefetched("mac", { record, version: record.version, dest, root }).problem, /no longer matches the SHA-256/);
    assert.equal(existsSync(join(dest, "keep.txt")), true, "a refused download leaves the release folder alone");
    assert.match(takePrefetched("mac", { record: { ...record, mac: 99 }, version: record.version, dest, root }).problem, /nothing was downloaded ahead|another build/);
    assert.match(takePrefetched("mac", { record, version: "0.3.13", dest, root }).problem, /another build/);
    downloaded(root, "windows", {}, { problem: "the Windows build failed: url", files: undefined });
    assert.match(takePrefetched("windows", { record, version: record.version, dest, root }).problem, /download ahead failed: the Windows build failed/);
    assert.deepEqual(pendingPlatforms(record, ["windows", "mac"], { version: record.version, root }), ["windows"], "the mac manifest is fine, its file is checked later");
    assert.deepEqual(pendingPlatforms({ ...record, mac: undefined }, ["mac"], { version: record.version, root }), [], "a prebuild without a mac run has nothing to download");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a background download counts as running only while its process is alive", () => {
  const root = mkdtempSync(join(tmpdir(), "fuyu-prefetch-"));
  try {
    const base = prefetchDir(record, root);
    assert.equal(fetchRunning(base), false);
    put(join(base, "fetch.lock"), JSON.stringify({ pid: process.pid }));
    assert.equal(fetchRunning(base), true);
    const gone = spawnSync(process.execPath, ["-e", "0"]).pid;
    put(join(base, "fetch.lock"), JSON.stringify({ pid: gone }));
    assert.equal(fetchRunning(base), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

const FAKE_ONE = `
import { writeFileSync } from "node:fs";
import { join } from "node:path";
const [command, platform, runId, version, base] = process.argv.slice(2);
if (command === "one") {
  const started = Date.now();
  await new Promise((resolve) => setTimeout(resolve, 400));
  writeFileSync(join(base, platform + ".json"), JSON.stringify({ platform, runId: Number(runId), version, started, ended: Date.now() }));
} else {
  writeFileSync(join(process.argv[4], "started-in-background"), process.argv[3]);
}
`;

test("Windows and macOS are downloaded at the same time and the lock goes away afterwards", async () => {
  const root = mkdtempSync(join(tmpdir(), "fuyu-prefetch-"));
  try {
    const script = join(root, "fake-prefetch.mjs");
    writeFileSync(script, FAKE_ONE);
    assert.equal(await prefetch(record, { root, script }), true);
    const base = prefetchDir(record, root);
    const [windows, mac] = ["windows", "mac"].map((platform) => JSON.parse(readFileSync(join(base, `${platform}.json`), "utf8")));
    assert.deepEqual([windows.runId, mac.runId, mac.version], [11, 12, record.version]);
    assert.ok(windows.started < mac.ended && mac.started < windows.ended, "the two downloads overlap instead of running one after the other");
    assert.equal(existsSync(join(base, "fetch.lock")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("pnpm release:prebuild clears the last download ahead and starts the next one in the background", async () => {
  const dir = mkdtempSync(join(tmpdir(), "fuyu-prefetch-"));
  const root = join(dir, "prebuilt");
  try {
    const script = join(dir, "fake-prefetch.mjs");
    writeFileSync(script, FAKE_ONE.replace("process.argv[4]", "process.argv[4] + '/' + JSON.parse(process.argv[3]).windows"));
    put(join(root, "7", "windows.json"), "{}");
    const log = startPrefetch(record, { root, script });
    assert.equal(log, join(prefetchDir(record, root), "download.log"));
    assert.equal(existsSync(join(root, "7")), false, "an older download ahead is removed");
    assert.equal(JSON.parse(readFileSync(join(prefetchDir(record, root), "fetch.lock"), "utf8")).pid > 0, true, "pnpm release sees the lock at once");
    const marker = join(prefetchDir(record, root), "started-in-background");
    for (let tries = 0; tries < 100 && !existsSync(marker); tries += 1) await new Promise((resolve) => setTimeout(resolve, 50));
    assert.deepEqual(JSON.parse(readFileSync(marker, "utf8")), record);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
