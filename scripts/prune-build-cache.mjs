import { existsSync, lstatSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mainCheckout, PUBLISH_DIR, targetDir } from "./build-dirs.mjs";

export const MAX_AGE_DAYS = 3;
export const KEEP = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

const OWN_UNIT = /^(fuyu|fuyu_lib|focusd_island|focusd_island_lib)-([0-9a-z]+)(?:\.|$)/;
const INCREMENTAL_UNIT = /^(.+)-([0-9a-z]+)$/;
const TEMP_ARCHIVE = /^\.tmp.*\.temp-archive$/;
const LANE_DIR = /^lane-(\d+|build)$/;
const KNOWN_DIRS = new Set(["debug", "release", "agents", PUBLISH_DIR]);

export function staleUnits(units, cutoff, keep = KEEP) {
  const byCrate = new Map();
  for (const unit of units) byCrate.set(unit.crate, [...(byCrate.get(unit.crate) ?? []), unit]);
  const stale = [];
  for (const group of byCrate.values()) {
    group.sort((a, b) => b.mtimeMs - a.mtimeMs);
    for (const unit of group.slice(keep)) if (unit.mtimeMs < cutoff) stale.push(unit.unit);
  }
  return stale.sort();
}

export function groupUnits(names, pattern, mtimeOf) {
  const units = new Map();
  const entriesOf = new Map();
  for (const name of names) {
    const match = pattern.exec(name);
    if (!match) continue;
    const unit = `${match[1]}-${match[2]}`;
    const mtimeMs = mtimeOf(name);
    const known = units.get(unit);
    units.set(unit, { unit, crate: match[1], mtimeMs: Math.max(known?.mtimeMs ?? 0, mtimeMs) });
    entriesOf.set(unit, [...(entriesOf.get(unit) ?? []), name]);
  }
  return { units: [...units.values()], entriesOf };
}

function sizeOf(file) {
  let stat;
  try {
    stat = lstatSync(file);
  } catch {
    return 0;
  }
  if (!stat.isDirectory()) return stat.size;
  return readdirSync(file).reduce((sum, name) => sum + sizeOf(path.join(file, name)), 0);
}

function mtime(file) {
  try {
    return lstatSync(file).mtimeMs;
  } catch {
    return 0;
  }
}

function list(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

export function profileDirs(target) {
  const candidates = list(target).flatMap((name) => {
    const dir = path.join(target, name);
    return [dir, ...list(dir).map((child) => path.join(dir, child))];
  });
  return candidates.filter((dir) => ["deps", "incremental"].some((sub) => existsSync(path.join(dir, sub))));
}

function profileItems(profile, cutoff) {
  const items = [];
  const incremental = path.join(profile, "incremental");
  const caches = groupUnits(list(incremental), INCREMENTAL_UNIT, (name) => mtime(path.join(incremental, name)));
  for (const unit of staleUnits(caches.units, cutoff)) items.push({ path: path.join(incremental, unit), kind: "incremental" });
  for (const sub of ["deps", "build", ".fingerprint"]) {
    const dir = path.join(profile, sub);
    const names = list(dir);
    const own = groupUnits(names, OWN_UNIT, (name) => mtime(path.join(dir, name)));
    for (const unit of staleUnits(own.units, cutoff)) {
      for (const name of own.entriesOf.get(unit)) items.push({ path: path.join(dir, name), kind: "own" });
    }
    for (const name of names) {
      if (TEMP_ARCHIVE.test(name) && mtime(path.join(dir, name)) < cutoff) items.push({ path: path.join(dir, name), kind: "temp" });
    }
  }
  return items;
}

export function plan(target, { now = Date.now(), maxAgeDays = MAX_AGE_DAYS } = {}) {
  const cutoff = now - maxAgeDays * DAY_MS;
  const items = profileDirs(target).flatMap((profile) => profileItems(profile, cutoff));
  const unknown = [];
  for (const name of list(target)) {
    const dir = path.join(target, name);
    if (!lstatSync(dir).isDirectory()) continue;
    if (LANE_DIR.test(name)) {
      items.push({ path: dir, kind: "lane" });
    } else if (!KNOWN_DIRS.has(name)) {
      unknown.push({ name, days: Math.floor((now - mtime(dir)) / DAY_MS) });
    }
  }
  const lanes = items.filter((item) => item.kind === "lane").map((item) => item.path + path.sep);
  return { items: items.filter((item) => item.kind === "lane" || !lanes.some((lane) => item.path.startsWith(lane))), unknown };
}

const KIND_NAMES = {
  incremental: "incremental caches",
  own: "old builds of this app",
  temp: "leftover temp archives",
  lane: "leftover lane previews",
};

export function prune(target, options = {}) {
  const { items, unknown } = plan(target, options);
  const counts = {};
  let bytes = 0;
  let failed = 0;
  for (const item of items) {
    const size = sizeOf(item.path);
    if (!options.dryRun) {
      try {
        rmSync(item.path, { recursive: true, force: true });
      } catch {
        failed += 1;
        continue;
      }
    }
    bytes += size;
    counts[item.kind] = (counts[item.kind] ?? 0) + 1;
  }
  return { bytes, counts, failed, unknown };
}

export function summary({ bytes, counts, failed, unknown }, dryRun = false) {
  const parts = Object.entries(counts).map(([kind, count]) => `${count} ${KIND_NAMES[kind]}`);
  const gb = (bytes / 1024 ** 3).toFixed(1);
  let line = parts.length ? `${dryRun ? "would free" : "freed"} ${gb} GB: ${parts.join(", ")}` : "nothing to delete";
  if (failed) line += `; ${failed} in use, left for next time`;
  if (unknown.length) line += `; not managed here: ${unknown.map((dir) => `${dir.name} (unused ${dir.days} d)`).join(", ")}`;
  return line;
}

export function pruneMainTarget(options = {}) {
  try {
    const main = mainCheckout();
    const result = prune(targetDir(main), options);
    console.log(`[prune] ${summary(result, options.dryRun)}`);
  } catch (error) {
    console.warn(`[prune] skipped: ${error.message}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const days = args.includes("--days") ? Number(args[args.indexOf("--days") + 1]) : MAX_AGE_DAYS;
  if (!Number.isFinite(days) || days < 0) {
    console.error("usage: pnpm prune:target [--dry-run] [--days N]");
    process.exit(1);
  }
  pruneMainTarget({ dryRun: args.includes("--dry-run"), maxAgeDays: days });
}
