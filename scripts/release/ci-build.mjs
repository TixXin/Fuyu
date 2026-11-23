import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { commandLine } from "./command-line.mjs";
import { dispatchedRun, sleep, watchRun } from "./smoke-test.mjs";
import { releaseClock, sizeText } from "./timing.mjs";

export function signerArgs(env, file) {
  const key = env.TAURI_SIGNING_PRIVATE_KEY ?? "";
  const fromFile = key && existsSync(key);
  const childEnv = { ...env };
  if (fromFile) delete childEnv.TAURI_SIGNING_PRIVATE_KEY;
  return { args: ["tauri", "signer", "sign", ...(fromFile ? ["-f", key] : []), file], env: childEnv };
}

export function signUpdate(file) {
  const { args, env } = signerArgs(process.env, file);
  const windows = process.platform === "win32";
  const result = spawnSync(windows ? commandLine("pnpm", args) : "pnpm", windows ? [] : args, { stdio: "inherit", shell: windows, windowsHide: true, env });
  return result.status === 0;
}

export function startCiBuild(run, { workflow, repo, revision, version }) {
  const since = Date.now();
  const started = run("gh", [
    "workflow", "run", workflow, "--repo", repo, "--ref", "main",
    "-f", `revision=${revision}`, "-f", `version=${version}`,
  ], { capture: true, allowFailure: true });
  if (started.status !== 0) return { problem: `could not start ${workflow}: ${started.stderr.trim()}` };
  return { since };
}

export function findCiRun(run, { workflow, repo, since }) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    sleep(5000);
    const listed = run("gh", ["run", "list", "--repo", repo, "--workflow", workflow, "--limit", "5", "--json", "databaseId,createdAt,event,url"], { capture: true, allowFailure: true });
    const found = listed.status === 0 ? dispatchedRun(JSON.parse(listed.stdout || "[]"), since) : null;
    if (found) return found;
  }
  return null;
}

export function dirBytes(dir) {
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile()) total += statSync(join(entry.parentPath ?? entry.path, entry.name)).size;
  }
  return total;
}

export function downloadCiBuild(run, { workflow, label, repo, artifact, since, runId, dir, clock = releaseClock, wait = sleep, now = Date.now, onBuilt = null }) {
  const found = runId ? { databaseId: runId, url: `https://github.com/${repo}/actions/runs/${runId}` } : findCiRun(run, { workflow, repo, since });
  if (!found) return `${workflow} was started but its run did not show up within a minute`;
  console.log(`${clock.stamp()} ${label} build running: ${found.url}`);
  if (!watchRun(run, { repo, id: found.databaseId, interval: 20 })) return `the ${label} build failed: ${found.url}`;
  clock.done(`${label} build`, `The ${label} build finished on GitHub Actions.`);
  onBuilt?.(found);
  mkdirSync(dir, { recursive: true });
  const before = dirBytes(dir);
  const started = now();
  let downloaded = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) wait(10000);
    downloaded = run("gh", ["run", "download", String(found.databaseId), "--repo", repo, "--name", artifact, "--dir", dir], { capture: true, allowFailure: true });
    if (downloaded.status === 0) {
      clock.done(`${label} download`, `Downloaded the ${label} build: ${sizeText(dirBytes(dir) - before, now() - started)}${attempt > 0 ? `, try ${attempt + 1}` : ""}.`);
      return null;
    }
  }
  return `could not download the ${label} build: ${downloaded.stderr.trim()}`;
}
