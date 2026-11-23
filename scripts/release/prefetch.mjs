import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mainCheckout, PUBLISH_DIR, targetDir } from "../build-dirs.mjs";
import { commandLine } from "./command-line.mjs";
import { finishMacBuild } from "./mac-build.mjs";
import { loadSigningEnvironment } from "./release-signing.mjs";
import { sleep, startSmoke } from "./smoke-test.mjs";
import { clockText, releaseClock } from "./timing.mjs";
import { finishWindowsBuild } from "./windows-build.mjs";

const REPO = "TixXin/fuyu";
const SELF = fileURLToPath(import.meta.url);
export const PREFETCH_ROOT = join(targetDir(mainCheckout(), PUBLISH_DIR), "prebuilt");
export const PLATFORMS = {
  windows: { label: "Windows", clear: [join("bundle", "nsis"), join("bundle", "msi"), "fuyu.exe"] },
  mac: { label: "macOS", clear: ["."] },
};

export function prefetchDir(record, root = PREFETCH_ROOT) {
  return join(root, String(record.windows));
}

export const logFile = (base) => join(base, "download.log");
const lockFile = (base) => join(base, "fetch.lock");
const manifestFile = (base, platform) => join(base, `${platform}.json`);
const smokeFile = (base) => join(base, "smoke.json");

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

export function fileHashes(dir) {
  const files = {};
  for (const entry of readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath ?? entry.path, entry.name);
    files[relative(dir, path).split(sep).join("/")] = sha256(path);
  }
  return files;
}

export function hashProblem(files, dir) {
  const names = Object.keys(files ?? {});
  if (names.length === 0) return "the download ahead has no files";
  for (const name of names) {
    const path = join(dir, name);
    if (!existsSync(path)) return `${name} is missing from the download ahead`;
    if (sha256(path) !== files[name]) return `${name} no longer matches the SHA-256 recorded when it was downloaded`;
  }
  return null;
}

export function manifestProblem(manifest, { runId, version }) {
  if (!manifest) return "nothing was downloaded ahead";
  if (manifest.problem) return `the download ahead failed: ${manifest.problem}`;
  if (manifest.runId !== runId || manifest.version !== version) return "the download ahead is from another build";
  return null;
}

export function takePrefetched(platform, { record, version, dest, root = PREFETCH_ROOT }) {
  const base = prefetchDir(record, root);
  const manifest = readJson(manifestFile(base, platform));
  const problem = manifestProblem(manifest, { runId: record[platform], version }) ?? hashProblem(manifest.files, join(base, platform));
  if (problem) return { problem };
  for (const path of PLATFORMS[platform].clear) rmSync(join(dest, path), { recursive: true, force: true });
  for (const name of Object.keys(manifest.files)) {
    mkdirSync(dirname(join(dest, name)), { recursive: true });
    cpSync(join(base, platform, name), join(dest, name));
  }
  const copied = hashProblem(manifest.files, dest);
  return copied ? { problem: copied } : { manifest };
}

export function smokeAhead(record, root = PREFETCH_ROOT) {
  const started = readJson(smokeFile(prefetchDir(record, root)));
  return started && started.buildRun === record.windows && Number.isInteger(started.databaseId) ? started : null;
}

function startSmokeAhead(base, buildRun) {
  const found = startSmoke(childRun, `build_run=${buildRun}`, REPO);
  if (typeof found === "string") {
    console.error(`  Could not start the smoke test ahead (${found}); pnpm release will test the draft.`);
    return;
  }
  writeFileSync(smokeFile(base), `${JSON.stringify({ buildRun, databaseId: found.databaseId, url: found.url }, null, 2)}\n`);
  console.log(`${releaseClock.stamp()} Smoke test of the Windows installer started: ${found.url}`);
}

export function prefetchSummary(manifest) {
  return (manifest.stages ?? []).map(({ ms, message }) => `    ${message ?? ""} (${clockText(ms)})`);
}

export function fetchRunning(base) {
  const pid = Number(readJson(lockFile(base))?.pid);
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

export function pendingPlatforms(record, platforms, { version, root = PREFETCH_ROOT }) {
  const base = prefetchDir(record, root);
  return platforms.filter((platform) => Number.isInteger(record[platform])
    && manifestProblem(readJson(manifestFile(base, platform)), { runId: record[platform], version }));
}

export async function readyPrefetch(record, platforms, { version, root = PREFETCH_ROOT, pause = 5000, timeout = 40 * 60_000, log = console.log } = {}) {
  const base = prefetchDir(record, root);
  if (fetchRunning(base)) {
    log(`${releaseClock.stamp()} Waiting for the download pnpm release:prebuild started in the background (log: ${logFile(base)}).`);
    const deadline = Date.now() + timeout;
    while (fetchRunning(base) && Date.now() < deadline) sleep(pause);
    releaseClock.done("wait for download ahead", "The background download is over.");
  }
  const pending = pendingPlatforms(record, platforms, { version, root });
  if (pending.length > 0) {
    log(`${releaseClock.stamp()} Downloading ${pending.map((platform) => PLATFORMS[platform].label).join(" and ")} in parallel.`);
    await prefetch(record, { root, platforms: pending });
    releaseClock.done("parallel download", `Parallel download of ${pending.length} build(s) is over.`);
  }
}

function childRun(command, args, options = {}) {
  const windows = process.platform === "win32";
  const result = spawnSync(windows ? commandLine(command, args) : command, windows ? [] : args, {
    stdio: options.capture ? "pipe" : "inherit", encoding: "utf8", shell: windows, windowsHide: true,
  });
  return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? result.error?.message ?? "" };
}

function fetchOne(platform, runId, version, base) {
  const dir = join(base, platform);
  rmSync(dir, { recursive: true, force: true });
  let problem;
  try {
    Object.assign(process.env, loadSigningEnvironment());
    const finish = platform === "windows" ? finishWindowsBuild : finishMacBuild;
    const onBuilt = platform === "windows" ? () => startSmokeAhead(base, runId) : null;
    problem = finish(childRun, { repo: REPO, version, runId, releaseDir: dir, dir, onBuilt });
  } catch (error) {
    problem = error.message;
  }
  const manifest = problem
    ? { platform, runId, version, problem }
    : { platform, runId, version, files: fileHashes(dir), stages: releaseClock.stages() };
  writeFileSync(manifestFile(base, platform), `${JSON.stringify(manifest, null, 2)}\n`);
  if (problem) console.error(`✗ ${PLATFORMS[platform].label}: ${problem}`);
  return problem ? 1 : 0;
}

export async function prefetch(record, { root = PREFETCH_ROOT, platforms = Object.keys(PLATFORMS), script = SELF } = {}) {
  const base = prefetchDir(record, root);
  mkdirSync(base, { recursive: true });
  writeFileSync(lockFile(base), JSON.stringify({ pid: process.pid }));
  try {
    const codes = await Promise.all(platforms.filter((platform) => Number.isInteger(record[platform])).map((platform) => new Promise((resolve) => {
      const child = spawn(process.execPath, [script, "one", platform, String(record[platform]), record.version, base], { stdio: "inherit", windowsHide: true });
      child.on("error", () => resolve(1));
      child.on("exit", (code) => resolve(code ?? 1));
    })));
    return codes.every((code) => code === 0);
  } finally {
    rmSync(lockFile(base), { force: true });
  }
}

export function startPrefetch(record, { root = PREFETCH_ROOT, script = SELF } = {}) {
  rmSync(root, { recursive: true, force: true });
  const base = prefetchDir(record, root);
  mkdirSync(base, { recursive: true });
  const out = openSync(logFile(base), "a");
  const child = spawn(process.execPath, [script, "all", JSON.stringify(record), root], { detached: true, stdio: ["ignore", out, out], windowsHide: true });
  writeFileSync(lockFile(base), JSON.stringify({ pid: child.pid }));
  child.unref();
  return logFile(base);
}

export function forgetPrefetch(root = PREFETCH_ROOT) {
  rmSync(root, { recursive: true, force: true });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, ...rest] = process.argv.slice(2);
  if (command === "one") {
    const [platform, runId, version, base] = rest;
    process.exitCode = fetchOne(platform, Number(runId), version, base);
  } else if (command === "all") {
    const ok = await prefetch(JSON.parse(rest[0]), { root: rest[1] });
    console.log(ok ? "\n✓ Both builds are downloaded and signed; pnpm release will use them." : "\n✗ Some downloads failed; pnpm release will download them again.");
    process.exitCode = ok ? 0 : 1;
  } else {
    console.error("usage: node scripts/release/prefetch.mjs one <platform> <runId> <version> <dir> | all <record> [root]");
    process.exitCode = 1;
  }
}
