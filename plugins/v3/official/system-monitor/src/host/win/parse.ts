import type { BatteryReading, GpuEngine, GpuEngineId } from "../../protocol.ts";
import type { ProgramRow } from "../programs.ts";

export interface HelperReply {
  id: number;
  ok: boolean;
  data: unknown;
  error?: string;
}

export interface SmiGpu {
  name: string | null;
  percent: number | null;
  temperatureC: number | null;
  memoryUsedBytes: number | null;
  memoryTotalBytes: number | null;
  powerW: number | null;
}

export interface EngineGpu {
  name: string | null;
  percent: number;
  memoryUsedBytes: number | null;
  engines: GpuEngine[];
}

export interface ProcessTimes {
  at: number;
  times: Map<number, number>;
}

const MIB = 1024 * 1024;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function list(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const wrapped = record(value);
  if (wrapped && Array.isArray(wrapped.value)) return wrapped.value;
  if (value === null || value === undefined) return [];
  return [value];
}

function num(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function parseHelperLine(line: string): HelperReply | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const raw = record(JSON.parse(trimmed));
    if (!raw) return null;
    const id = num(raw.id);
    if (id === null) return null;
    return {
      id,
      ok: raw.ok === true,
      data: raw.data ?? null,
      error: typeof raw.error === "string" ? raw.error : undefined,
    };
  } catch {
    return null;
  }
}

export function parseNetCounters(data: unknown): { received: number; sent: number } | null {
  const raw = record(data);
  const received = num(raw?.received);
  const sent = num(raw?.sent);
  return received === null || sent === null ? null : { received, sent };
}

const CHARGING = new Set([6, 7, 8, 9]);
const PLUGGED = new Set([2, 3, 6, 7, 8, 9, 11]);

export function parseBattery(data: unknown): BatteryReading | null {
  const raw = record(data);
  if (!raw || raw.present !== true) return null;
  const percent = num(raw.percent);
  const status = num(raw.status) ?? 0;
  if (percent === null) return null;
  return {
    percent: Math.max(0, Math.min(100, Math.round(percent))),
    charging: CHARGING.has(status),
    pluggedIn: PLUGGED.has(status),
  };
}

export function parseThermal(data: unknown): number | null {
  const values = list(record(data)?.values)
    .map(num)
    .filter((value): value is number => value !== null && value > 0);
  if (values.length === 0) return null;
  return Math.round((Math.max(...values) / 10 - 273.15) * 10) / 10;
}

export function parseProcesses(
  data: unknown,
  prev: ProcessTimes | null,
  at: number,
  cores: number,
): { rows: ProgramRow[] | null; times: ProcessTimes } {
  const times = new Map<number, number>();
  const parsed: { id: number; name: string; time: number; memory: number }[] = [];
  for (const item of list(record(data)?.rows)) {
    const row = list(item);
    const id = num(row[0]);
    const time = num(row[2]);
    const memory = num(row[3]);
    if (id === null || id === 0 || time === null) continue;
    const name = String(row[1] ?? "").replace(/\.exe$/i, "");
    times.set(id, time);
    parsed.push({ id, name, time, memory: memory ?? 0 });
  }
  const next = { at, times };
  if (!prev) return { rows: null, times: next };
  const span = Math.max(1, at - prev.at) * 10000 * Math.max(1, cores);
  const rows = parsed.map((entry) => {
    const before = prev.times.get(entry.id);
    const used = before === undefined ? 0 : Math.max(0, entry.time - before);
    return { name: entry.name, cpuPercent: (used / span) * 100, memoryBytes: entry.memory };
  });
  return { rows, times: next };
}

export function parseNvidiaSmi(text: string): SmiGpu | null {
  const line = text.split(/\r?\n/).find((item) => item.trim().length > 0);
  if (!line) return null;
  const parts = line.split(",").map((item) => item.trim());
  if (parts.length < 6) return null;
  const used = num(parts[3]);
  const total = num(parts[4]);
  return {
    name: parts[0] || null,
    percent: num(parts[1]),
    temperatureC: num(parts[2]),
    memoryUsedBytes: used === null ? null : used * MIB,
    memoryTotalBytes: total === null ? null : total * MIB,
    powerW: num(parts[5]),
  };
}

const ENGINE_KEY = /^(luid_0x[0-9a-f]+_0x[0-9a-f]+_phys_\d+)_eng_(\d+)_engtype_(.*)$/i;

const ENGINE_TYPES: readonly [GpuEngineId, string][] = [
  ["3d", "3d"],
  ["copy", "copy"],
  ["decode", "videodecode"],
  ["encode", "videoencode"],
];

export function parseGpuEngines(data: unknown): EngineGpu | "pending" | null {
  const raw = record(data);
  if (!raw || raw.failed === true) return null;
  if (raw.pending === true) return "pending";
  const engines = record(raw.engines) ?? {};
  const memory = record(raw.memory) ?? {};
  const parsed: { adapter: string; type: string; value: number }[] = [];
  for (const [key, value] of Object.entries(engines)) {
    const match = ENGINE_KEY.exec(key);
    const n = num(value);
    if (!match || n === null) continue;
    parsed.push({ adapter: match[1].toLowerCase(), type: match[3].toLowerCase(), value: n });
  }
  if (parsed.length === 0) return null;
  const memoryByAdapter = new Map<string, number>();
  for (const [key, value] of Object.entries(memory)) {
    const n = num(value);
    if (n !== null) memoryByAdapter.set(key.toLowerCase(), n);
  }
  let adapter = parsed[0].adapter;
  let most = -1;
  for (const [key, value] of memoryByAdapter) {
    if (value > most && parsed.some((entry) => entry.adapter === key)) {
      most = value;
      adapter = key;
    }
  }
  const types = new Map<string, number>();
  for (const entry of parsed) {
    if (entry.adapter !== adapter) continue;
    types.set(entry.type, Math.max(types.get(entry.type) ?? 0, Math.min(100, entry.value)));
  }
  const busiest = (prefix: string) => {
    let best = 0;
    for (const [type, value] of types) if (type.startsWith(prefix)) best = Math.max(best, value);
    return Math.round(best);
  };
  let percent = 0;
  for (const value of types.values()) percent = Math.max(percent, value);
  const used = memoryByAdapter.get(adapter);
  return {
    name: typeof raw.name === "string" && raw.name ? raw.name : null,
    percent: Math.round(percent),
    memoryUsedBytes: used === undefined ? null : used,
    engines: ENGINE_TYPES.map(([id, prefix]) => ({ id, percent: busiest(prefix) })),
  };
}
