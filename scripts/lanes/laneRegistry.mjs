import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
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

export function commonDir(main) {
  const out = execFileSync("git", ["rev-parse", "--git-common-dir"], { cwd: main, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  return path.resolve(main, out);
}

function queueFile(main) {
  return path.join(commonDir(main), "claude-code-merge-queue", "lane-owners.json");
}

function sessionsFile(main) {
  return path.join(commonDir(main), "claude-code-merge-queue", "lane-sessions.json");
}

function releasedFile(main) {
  return path.join(commonDir(main), "claude-code-merge-queue", "lane-released.json");
}

export function readReleased(main) {
  return readJson(releasedFile(main));
}

export function releasedAt(main, lane, released = readReleased(main)) {
  return Date.parse(released[ownerKey(lanePath(main, lane))] ?? "") || 0;
}

export function markReleased(main, lane, now = new Date()) {
  const released = readReleased(main);
  released[ownerKey(lanePath(main, lane))] = now.toISOString();
  writeJson(releasedFile(main), released);
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

export function readOwners(main) {
  return { ...readJson(queueFile(main)), ...readJson(sessionsFile(main)) };
}

export function ownerOf(main, lane, owners = readOwners(main)) {
  return owners[ownerKey(lanePath(main, lane))] ?? null;
}

export function recordOwner(main, lane, { pid, name, session = null }, now = new Date()) {
  const key = ownerKey(lanePath(main, lane));
  const sessions = readJson(sessionsFile(main));
  const known = sessions[key];
  const since = known && known.pid === (pid ?? null) && known.name === name ? known.since : now.toISOString();
  sessions[key] = { pid: pid ?? null, ...(name ? { name } : {}), ...(session ? { session } : {}), since, seen: now.toISOString() };
  writeJson(sessionsFile(main), sessions);
  const queue = readJson(queueFile(main));
  if (pid) queue[key] = { pid, since };
  else delete queue[key];
  writeJson(queueFile(main), queue);
  const released = readReleased(main);
  if (released[key]) {
    delete released[key];
    writeJson(releasedFile(main), released);
  }
}

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

export function claudeSessionsDir() {
  return path.join(homedir(), ".claude", "sessions");
}

function readSessions(dir) {
  let names = [];
  try {
    names = readdirSync(dir).filter((name) => name.endsWith(".json"));
  } catch {
    return [];
  }
  return names.map((name) => readJson(path.join(dir, name))).filter((entry) => entry.sessionId && entry.pid);
}

export function sessionAlive(sessionId, dir = claudeSessionsDir()) {
  if (!sessionId) return null;
  return readSessions(dir).some((entry) => entry.sessionId === sessionId && pidAlive(entry.pid));
}

export function currentSession(env = process.env, dir = claudeSessionsDir()) {
  const session = env.CLAUDE_CODE_SESSION_ID || null;
  const pid = Number(env.CLAUDE_PID) || null;
  const entry = readSessions(dir).find((item) => (session && item.sessionId === session) || (pid && item.pid === pid));
  return { session: session ?? entry?.sessionId ?? null, pid: pid ?? entry?.pid ?? null, name: entry?.name ?? null };
}

export function claudePid(start = process.pid) {
  const fromEnv = Number(process.env.CLAUDE_PID);
  if (fromEnv && pidAlive(fromEnv)) return fromEnv;
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
