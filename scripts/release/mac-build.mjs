import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { commandLine } from "./command-line.mjs";
import { dispatchedRun } from "./smoke-test.mjs";

export const MAC_WORKFLOW = "release-macos.yml";

export function macArtifact(version) {
  return `fuyu-macos-${version}`;
}

export function macFiles(dir, version) {
  const archive = join(dir, `Fuyu_${version}_aarch64.app.tar.gz`);
  return { archive, signature: `${archive}.sig`, dmg: join(dir, `Fuyu_${version}_aarch64.dmg`) };
}

export function signerArgs(env, file) {
  const key = env.TAURI_SIGNING_PRIVATE_KEY ?? "";
  const fromFile = key && existsSync(key);
  const childEnv = { ...env };
  if (fromFile) delete childEnv.TAURI_SIGNING_PRIVATE_KEY;
  return { args: ["tauri", "signer", "sign", ...(fromFile ? ["-f", key] : []), file], env: childEnv };
}

function signUpdate(file) {
  const { args, env } = signerArgs(process.env, file);
  const windows = process.platform === "win32";
  const result = spawnSync(windows ? commandLine("pnpm", args) : "pnpm", windows ? [] : args, { stdio: "inherit", shell: windows, windowsHide: true, env });
  return result.status === 0;
}

export function startMacBuild(run, { repo, revision, version }) {
  const since = Date.now();
  const started = run("gh", [
    "workflow", "run", MAC_WORKFLOW, "--repo", repo, "--ref", "main",
    "-f", `revision=${revision}`, "-f", `version=${version}`,
  ], { capture: true, allowFailure: true });
  if (started.status !== 0) return { problem: `could not start ${MAC_WORKFLOW}: ${started.stderr.trim()}` };
  return { since };
}

export function finishMacBuild(run, { repo, version, since, dir }) {
  let found = null;
  for (let attempt = 0; attempt < 12 && !found; attempt += 1) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5000);
    const listed = run("gh", ["run", "list", "--repo", repo, "--workflow", MAC_WORKFLOW, "--limit", "5", "--json", "databaseId,createdAt,event,url"], { capture: true, allowFailure: true });
    if (listed.status === 0) found = dispatchedRun(JSON.parse(listed.stdout || "[]"), since);
  }
  if (!found) return `${MAC_WORKFLOW} was started but its run did not show up within a minute`;
  console.log(`macOS build running: ${found.url}`);
  const watched = run("gh", ["run", "watch", String(found.databaseId), "--repo", repo, "--exit-status", "--interval", "20"], { allowFailure: true });
  if (watched.status !== 0) return `the macOS build failed: ${found.url}`;
  mkdirSync(dir, { recursive: true });
  const downloaded = run("gh", ["run", "download", String(found.databaseId), "--repo", repo, "--name", macArtifact(version), "--dir", dir], { capture: true, allowFailure: true });
  if (downloaded.status !== 0) return `could not download the macOS build: ${downloaded.stderr.trim()}`;
  const files = macFiles(dir, version);
  if (!existsSync(files.archive) || !existsSync(files.dmg)) return `the macOS build has no ${files.archive} or ${files.dmg}`;
  if (!signUpdate(files.archive) || !existsSync(files.signature)) return "could not sign the macOS update package with the updater key";
  return null;
}
