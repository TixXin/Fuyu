// Where lanes live and who uses them, keyed by the lane's path in lower case.
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

// Two files. The merge queue's lane-owners.json ({ pid, since }) decides its land-time
// pruning: a lane whose pid no longer runs is deleted, a lane with no entry is kept. So a
// session whose claude.exe could not be found must never land there with an empty pid (that
// once deleted a lane in use); it is left out of it and kept in lane-sessions.json, which
// holds every check-in with the session's name and last check-in (`seen`).
function queueFile(main) {
  return path.join(commonDir(main), "claude-code-merge-queue", "lane-owners.json");
}

function sessionsFile(main) {
  return path.join(commonDir(main), "claude-code-merge-queue", "lane-sessions.json");
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

function writeJson(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temp, file);
}

/** Every lane's owner: the merge queue's records (lanes made by its hook), overridden by check-ins. */
export function readOwners(main) {
  return { ...readJson(queueFile(main)), ...readJson(sessionsFile(main)) };
}

/** The owner record of lane `lane`, or null. */
export function ownerOf(main, lane, owners = readOwners(main)) {
  return owners[ownerKey(lanePath(main, lane))] ?? null;
}

/** Records `{ pid, name }` as using lane `lane`. */
export function recordOwner(main, lane, { pid, name }, now = new Date()) {
  const key = ownerKey(lanePath(main, lane));
  const sessions = readJson(sessionsFile(main));
  const known = sessions[key];
  const since = known && known.pid === (pid ?? null) && known.name === name ? known.since : now.toISOString();
  sessions[key] = { pid: pid ?? null, ...(name ? { name } : {}), since, seen: now.toISOString() };
  writeJson(sessionsFile(main), sessions);
  const queue = readJson(queueFile(main));
  if (pid) queue[key] = { pid, since };
  else delete queue[key];
  writeJson(queueFile(main), queue);
}

/** Marks lane `lane`'s recorded session as still there (a land from it); false when the lane has no record. */
export function touchOwner(main, lane, now = new Date()) {
  const key = ownerKey(lanePath(main, lane));
  const sessions = readJson(sessionsFile(main));
  const owner = sessions[key] ?? readJson(queueFile(main))[key];
  if (!owner) return false;
  sessions[key] = { ...owner, seen: now.toISOString() };
  writeJson(sessionsFile(main), sessions);
  return true;
}

export function forgetOwner(main, lane) {
  const key = ownerKey(lanePath(main, lane));
  for (const file of [sessionsFile(main), queueFile(main)]) {
    const records = readJson(file);
    delete records[key];
    writeJson(file, records);
  }
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
