import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const run = promisify(execFile);
const MB = 1048576;

export function parseFootprint(text) {
  const match = /phys_footprint:\s*(\d+)\s*B/.exec(text);
  if (!match) throw new Error(`no phys_footprint in footprint's output: ${text.slice(0, 200)}`);
  return Number(match[1]);
}

export function parseBytes(text) {
  const value = Number(String(text).trim());
  if (!Number.isFinite(value) || value <= 0) throw new Error(`not a byte count: ${String(text).slice(0, 200)}`);
  return value;
}

export function parseLinuxStatus(text) {
  const match = /^VmRSS:\s*(\d+)\s*kB/m.exec(text);
  if (!match) throw new Error("no VmRSS in /proc status");
  return Number(match[1]) * 1024;
}

export const MEMORY_KIND = {
  darwin: "phys_footprint",
  win32: "private",
  linux: "rss",
};

export async function readMemory(pid, platform = process.platform) {
  if (platform === "darwin") {
    const { stdout } = await run("/usr/bin/footprint", ["-f", "bytes", "--noCategories", "-p", String(pid)]);
    return parseFootprint(stdout);
  }
  if (platform === "win32") {
    const { stdout } = await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `(Get-Process -Id ${pid}).PrivateMemorySize64`], { windowsHide: true });
    return parseBytes(stdout);
  }
  if (platform === "linux") return parseLinuxStatus(await readFile(`/proc/${pid}/status`, "utf8"));
  throw new Error(`no way to read memory on ${platform}`);
}

export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export const toMB = (bytes) => Math.round((bytes / MB) * 10) / 10;

export const CSV_HEADER = "at,elapsed_s,memory_mb,ping_ms,host_pid,restarts\n";

export function csvRow({ at, elapsedS, bytes, pingMs, pid, restarts }) {
  return `${new Date(at).toISOString()},${Math.round(elapsedS)},${bytes == null ? "" : toMB(bytes)},${pingMs ?? ""},${pid ?? ""},${restarts}\n`;
}
