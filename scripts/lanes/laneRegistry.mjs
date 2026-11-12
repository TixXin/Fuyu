// Where lanes live and who uses them. The record is the merge queue's own
// .git/claude-code-merge-queue/lane-owners.json ({ "<lane path, lower case>": { pid,
// since } }), so its land-time pruning keeps reading it; this adds the session's
// name and when it last said it was there (`seen`).
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

export const LANES_FOLDER_SUFFIX = "-lanes";
export const BRANCH_PREFIX = "lane/";
export const MAX_LANE = 200;

export function lanesRoot(main) {
  return path.join(path.dirname(main), `${path.basename(main)}${LANES_FOLDER_SUFFIX}`);
}

export function lanePath(main, lane) {
  return path.join(lanesRoot(main), String(lane));
}

/** The lane `dir` is in (or is), or null. */
export function laneOf(main, dir) {
  if (!dir) return null;
  const relative = path.relative(lanesRoot(main), path.resolve(dir));
  const first = relative.split(/[\\/]/)[0];
  const lane = Number(first);
  return !relative.startsWith("..") && !path.isAbsolute(relative) && /^\d+$/.test(first) && lane > 0 && lane <= MAX_LANE ? lane : null;
}

export function ownerKey(dir) {
  return path.resolve(dir).toLowerCase();
}

/** The repository's shared git folder, from the main checkout or any lane. */
export function commonDir(main) {
  const out = execFileSync("git", ["rev-parse", "--git-common-dir"], { cwd: main, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  return path.resolve(main, out);
}

function ownersFile(main) {
  return path.join(commonDir(main), "claude-code-merge-queue", "lane-owners.json");
}

export function readOwners(main) {
  try {
    return JSON.parse(readFileSync(ownersFile(main), "utf8"));
  } catch {
    return {};
  }
}

function writeOwners(main, owners) {
  const file = ownersFile(main);
  mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(owners, null, 2)}\n`);
  renameSync(temp, file);
}

/** The owner record of lane `lane`, or null. */
export function ownerOf(main, lane, owners = readOwners(main)) {
  return owners[ownerKey(lanePath(main, lane))] ?? null;
}

/** Records `{ pid, name }` as using lane `lane`. */
export function recordOwner(main, lane, { pid, name }, now = new Date()) {
  const owners = readOwners(main);
  const key = ownerKey(lanePath(main, lane));
  const since = owners[key]?.pid === pid && owners[key]?.name === name ? owners[key].since : now.toISOString();
  owners[key] = { pid: pid ?? null, ...(name ? { name } : {}), since, seen: now.toISOString() };
  writeOwners(main, owners);
}

export function forgetOwner(main, lane) {
  const owners = readOwners(main);
  delete owners[ownerKey(lanePath(main, lane))];
  writeOwners(main, owners);
}

export function pidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

/** The nearest claude.exe above this process (the session running it), or null. */
export function claudePid(start = process.pid) {
  if (process.platform !== "win32") return null;
  let rows;
  try {
    const out = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
      "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name | ConvertTo-Json -Compress"],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
    rows = JSON.parse(out);
  } catch {
    return null;
  }
  const byPid = new Map(rows.map((row) => [row.ProcessId, row]));
  let row = byPid.get(start);
  for (let hops = 0; row && hops < 32; hops += 1) {
    if (/^claude(\.exe)?$/i.test(row.Name ?? "")) return row.ProcessId;
    row = byPid.get(row.ParentProcessId);
  }
  return null;
}
