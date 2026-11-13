import { spawnSync } from "node:child_process";
import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "./build-app-macos.mjs";
import { mainCheckout, targetDir } from "./build-dirs.mjs";
import { backgroundBuildEnv, lowerPriority } from "./build-load.mjs";

export const EXE_NAME = "fuyu.exe";
const OLD_PREFIX = `${EXE_NAME}.old-`;

export function isInUse(file) {
  if (!existsSync(file)) return false;
  try {
    closeSync(openSync(file, "r+"));
    return false;
  } catch (error) {
    return error.code === "EBUSY" || error.code === "EPERM" || error.code === "EACCES";
  }
}

export function removeOldExes(dir) {
  let left = 0;
  for (const name of existsSync(dir) ? readdirSync(dir) : []) {
    if (!name.startsWith(OLD_PREFIX)) continue;
    try {
      unlinkSync(path.join(dir, name));
    } catch {
      left += 1;
    }
  }
  return left;
}

export function moveAsideIfRunning(exe, now = new Date()) {
  if (!isInUse(exe)) return null;
  const aside = `${exe}.old-${now.toISOString().replace(/[-:.TZ]/g, "")}`;
  renameSync(exe, aside);
  return aside;
}

const LOCK_MAX_AGE_MS = 60 * 60 * 1000;
const LOCK_WAIT_MS = 5000;

function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

export function lockHeld(holder, now = Date.now(), alive = processAlive) {
  return Boolean(holder) && alive(holder.pid) && now - holder.since < LOCK_MAX_AGE_MS;
}

export function takeLock(lock) {
  mkdirSync(path.dirname(lock), { recursive: true });
  for (let waited = false; ; waited = true) {
    try {
      writeFileSync(lock, JSON.stringify({ pid: process.pid, since: Date.now() }), { flag: "wx" });
      return;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    let holder = null;
    try {
      holder = JSON.parse(readFileSync(lock, "utf8"));
    } catch {
    }
    if (holder && !lockHeld(holder)) {
      unlinkSync(lock);
      continue;
    }
    if (!waited) console.log(`[build:exe] another build (pid ${holder?.pid ?? "?"}) is running; waiting for it to finish`);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, LOCK_WAIT_MS);
  }
}

export function shortcutScript(exe) {
  const quoted = `'${exe.replace(/'/g, "''")}'`;
  return [
    `$exe = ${quoted}`,
    "$desk = [Environment]::GetFolderPath('Desktop')",
    "$shell = New-Object -ComObject WScript.Shell",
    "$links = @(Get-ChildItem $desk -Filter *.lnk | Where-Object { $_.Name -match 'focusd|fly-island|fuyu' -or $shell.CreateShortcut($_.FullName).TargetPath -match '(focusd-island|fuyu)\\.exe$' })",
    "if ($links.Count -eq 0) { $links = @([pscustomobject]@{ FullName = Join-Path $desk \"$([char]0x6D6E)$([char]0x5C7F).lnk\" }) }",
    "foreach ($link in $links) {",
    "  $s = $shell.CreateShortcut($link.FullName); $s.TargetPath = $exe; $s.WorkingDirectory = Split-Path $exe; $s.IconLocation = \"$exe,0\"; $s.Save()",
    "  $check = $shell.CreateShortcut($link.FullName)",
    "  if ($check.TargetPath -ne $exe -or -not (Test-Path $check.TargetPath)) { Write-Error \"$($link.FullName) does not point at $exe\"; exit 1 }",
    "  Write-Output (Split-Path $link.FullName -Leaf)",
    "}",
  ].join("\n");
}

function syncShortcut(exe) {
  if (process.platform !== "win32" || process.env.FUYU_SYNC_SHORTCUT !== "1") return;
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", shortcutScript(exe)], { encoding: "utf8" });
  if (result.status === 0) console.log(`[build:exe] desktop shortcut → ${exe}: ${result.stdout.trim().split(/\r?\n/).join(", ")}`);
  else console.error(`[build:exe] could not update the desktop shortcut: ${result.stderr.trim()}`);
}

function withReleaseDir(work) {
  const releaseDir = targetDir(mainCheckout(), "release");
  const lock = path.join(releaseDir, ".build-exe.lock");
  takeLock(lock);
  try {
    return work(releaseDir);
  } finally {
    rmSync(lock, { force: true });
  }
}

export function installExe(source) {
  return withReleaseDir((releaseDir) => {
    const exe = path.join(releaseDir, EXE_NAME);
    if (path.resolve(source).toLowerCase() === exe.toLowerCase()) {
      syncShortcut(exe);
      return exe;
    }
    removeOldExes(releaseDir);
    const aside = moveAsideIfRunning(exe);
    try {
      copyFileSync(source, exe);
    } catch (error) {
      if (aside && !existsSync(exe)) renameSync(aside, exe);
      throw error;
    }
    removeOldExes(releaseDir);
    syncShortcut(exe);
    return exe;
  });
}

function main() {
  lowerPriority("build:exe");
  return withReleaseDir(process.platform === "darwin" ? buildApp : build);
}

function build(releaseDir) {
  const exe = path.join(releaseDir, EXE_NAME);
  removeOldExes(releaseDir);
  const aside = moveAsideIfRunning(exe);
  if (aside) console.log(`[build:exe] the island is running; moved its exe aside to ${path.basename(aside)}. It keeps running; the next start uses the new build.`);
  const status = spawnSync("pnpm tauri build --no-bundle", {
    shell: true,
    stdio: "inherit",
    env: { ...process.env, CARGO_TARGET_DIR: targetDir(mainCheckout()), ...backgroundBuildEnv() },
  }).status;
  if (status !== 0 || !existsSync(exe)) {
    if (aside && !existsSync(exe)) renameSync(aside, exe);
    console.error(`[build:exe] the build failed${aside ? "; the previous exe is back in place" : ""}.`);
    return 1;
  }
  const left = removeOldExes(releaseDir);
  console.log(`[build:exe] built ${exe}${left > 0 ? ` (${left} older exe still running, removed by a later build)` : ""}`);
  syncShortcut(exe);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
