import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeTimers } from "../timers.ts";

export const DATA_FILE = "data/timer/timers.json";
export const DATA_FORMAT = 1;

export function readTimers(file) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    return error?.code === "ENOENT" ? { timers: [] } : { timers: [], problem: error };
  }
  try {
    return { timers: normalizeTimers(JSON.parse(text)?.timers) };
  } catch (error) {
    return { timers: [], problem: error };
  }
}

export function writeTimers(file, timers) {
  const path = fileURLToPath(file);
  const temp = `${path}.tmp`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(temp, `${JSON.stringify({ version: DATA_FORMAT, timers })}\n`);
  renameSync(temp, path);
}
