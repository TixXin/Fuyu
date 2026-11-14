import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { commandLine } from "./command-line.mjs";
import { dispatchedRun, sleep, watchRun } from "./smoke-test.mjs";

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

export function downloadCiBuild(run, { workflow, label, repo, artifact, since, dir }) {
  let found = null;
  for (let attempt = 0; attempt < 12 && !found; attempt += 1) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5000);
    const listed = run("gh", ["run", "list", "--repo", repo, "--workflow", workflow, "--limit", "5", "--json", "databaseId,createdAt,event,url"], { capture: true, allowFailure: true });
    if (listed.status === 0) found = dispatchedRun(JSON.parse(listed.stdout || "[]"), since);
  }
  if (!found) return `${workflow} was started but its run did not show up within a minute`;
  console.log(`${label} build running: ${found.url}`);
  if (!watchRun(run, { repo, id: found.databaseId, interval: 20 })) return `the ${label} build failed: ${found.url}`;
  mkdirSync(dir, { recursive: true });
  let downloaded = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) sleep(10000);
    downloaded = run("gh", ["run", "download", String(found.databaseId), "--repo", repo, "--name", artifact, "--dir", dir], { capture: true, allowFailure: true });
    if (downloaded.status === 0) return null;
  }
  return `could not download the ${label} build: ${downloaded.stderr.trim()}`;
}
