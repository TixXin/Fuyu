import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const STAGING_SUBDIR = ".staging";

const RENAME_RETRIES = 5;
const RETRY_MS = 40;
const RETRYABLE = new Set(["EPERM", "EACCES", "EBUSY"]);

const live = new Set();

const token = () => randomBytes(6).toString("hex");
const hexOf = (id) => Buffer.from(id, "utf8").toString("hex");

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function renameWithRetry(from, to) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      renameSync(from, to);
      return;
    } catch (error) {
      if (attempt >= RENAME_RETRIES || !RETRYABLE.has(error?.code)) throw error;
      sleep(RETRY_MS * (attempt + 1));
    }
  }
}

export function stagingRoot(packagesRoot) {
  return join(packagesRoot, STAGING_SUBDIR);
}

function restoreBackup(path, target) {
  try {
    mkdirSync(dirname(target), { recursive: true });
    renameWithRetry(path, target);
    return true;
  } catch {
    return false;
  }
}

export function recoverStaging(packagesRoot, targetFor) {
  const root = stagingRoot(packagesRoot);
  if (!existsSync(root)) return;
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (live.has(path)) continue;
    const match = /^old\.([0-9a-f]+)\.[0-9a-f]+$/.exec(entry);
    let target = null;
    if (match) {
      try {
        target = targetFor(Buffer.from(match[1], "hex").toString("utf8"));
      } catch {
        target = null;
      }
    }
    if (target && !existsSync(target) && restoreBackup(path, target)) continue;
    rmSync(path, { recursive: true, force: true, maxRetries: 3 });
  }
}

export function writeStaged(packagesRoot, files) {
  const dir = join(stagingRoot(packagesRoot), `new.${token()}`);
  mkdirSync(dir, { recursive: true });
  live.add(dir);
  try {
    for (const entry of files) {
      const dest = join(dir, ...entry.path.split("/"));
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, entry.data);
    }
  } catch (error) {
    live.delete(dir);
    rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    throw error;
  }
  return dir;
}

export function discardStaged(staged) {
  for (const item of staged ?? []) {
    if (!item?.dir) continue;
    live.delete(item.dir);
    rmSync(item.dir, { recursive: true, force: true, maxRetries: 3 });
  }
}

function rollback(packagesRoot, done) {
  for (const item of [...done].reverse()) {
    try {
      if (item.committed && existsSync(item.target)) {
        const trash = join(stagingRoot(packagesRoot), `bad.${token()}`);
        renameWithRetry(item.target, trash);
        rmSync(trash, { recursive: true, force: true, maxRetries: 3 });
      }
      if (item.backup && existsSync(item.backup)) renameWithRetry(item.backup, item.target);
    } catch {
      continue;
    }
  }
}

function snapshotFile(file) {
  return existsSync(file) ? readFileSync(file) : null;
}

function restoreFile(file, saved) {
  try {
    if (saved === null) rmSync(file, { force: true });
    else writeFileSync(file, saved);
  } catch {
    return;
  }
}

export function swapStaged(packagesRoot, staged, { configFile, writeConfig }) {
  let savedConfig;
  try {
    savedConfig = snapshotFile(configFile);
  } catch (error) {
    discardStaged(staged);
    throw error;
  }
  const done = [];
  try {
    for (const item of staged) {
      mkdirSync(dirname(item.target), { recursive: true });
      const record = { target: item.target, backup: null, committed: false };
      done.push(record);
      if (existsSync(item.target)) {
        const backup = join(stagingRoot(packagesRoot), `old.${hexOf(item.id)}.${token()}`);
        renameWithRetry(item.target, backup);
        record.backup = backup;
      }
      renameWithRetry(item.dir, item.target);
      live.delete(item.dir);
      record.committed = true;
    }
    for (const item of staged) writeConfig(item);
  } catch (error) {
    rollback(packagesRoot, done);
    restoreFile(configFile, savedConfig);
    discardStaged(staged);
    throw error;
  }
  for (const record of done) {
    if (record.backup) rmSync(record.backup, { recursive: true, force: true, maxRetries: 3 });
  }
}
