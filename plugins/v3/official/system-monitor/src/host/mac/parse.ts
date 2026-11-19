import type { BatteryReading } from "../../protocol.ts";
import type { ProgramRow } from "../programs.ts";

export interface MacMemory {
  usedBytes: number;
}

export interface MacGpu {
  name: string | null;
  percent: number;
  memoryUsedBytes: number | null;
}

export interface MacBattery {
  battery: BatteryReading | null;
}

function pageCount(text: string, label: string): number | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^"?${escaped}"?:\\s+(\\d+)\\.?\\s*$`, "m").exec(text);
  return match ? Number(match[1]) : null;
}

export function parseVmStat(text: string): MacMemory | null {
  const size = /page size of (\d+) bytes/.exec(text);
  const anonymous = pageCount(text, "Anonymous pages");
  const purgeable = pageCount(text, "Pages purgeable");
  const wired = pageCount(text, "Pages wired down");
  const compressed = pageCount(text, "Pages occupied by compressor");
  if (!size || anonymous === null || wired === null || compressed === null) return null;
  const app = Math.max(0, anonymous - (purgeable ?? 0));
  return { usedBytes: (app + wired + compressed) * Number(size[1]) };
}

export function parseNetstat(text: string): { received: number; sent: number } | null {
  const lines = text.split(/\r?\n/);
  const header = lines[0]?.trim().split(/\s+/) ?? [];
  const ibytes = header.indexOf("Ibytes");
  const obytes = header.indexOf("Obytes");
  if (ibytes < 0 || obytes < 0) return null;
  let received = 0;
  let sent = 0;
  let seen = false;
  for (const line of lines.slice(1)) {
    const cols = line.trim().split(/\s+/);
    if (cols.length < 3 || !/^<Link#\d+>$/.test(cols[2])) continue;
    if (/^lo\d*\*?$/.test(cols[0])) continue;
    const rx = Number(cols[cols.length - (header.length - ibytes)]);
    const tx = Number(cols[cols.length - (header.length - obytes)]);
    if (!Number.isFinite(rx) || !Number.isFinite(tx)) continue;
    received += rx;
    sent += tx;
    seen = true;
  }
  return seen ? { received, sent } : { received: 0, sent: 0 };
}

export function decodeVis(text: string): string {
  if (!text.includes("M-") && !text.includes("M^")) return text;
  const bytes: number[] = [];
  for (let i = 0; i < text.length; ) {
    const marker = text.slice(i, i + 2);
    const next = text.charCodeAt(i + 2);
    if ((marker === "M-" || marker === "M^") && i + 2 < text.length && next < 0x80) {
      bytes.push(marker === "M-" ? next | 0x80 : (next ^ 0x40) | 0x80);
      i += 3;
      continue;
    }
    const code = text.charCodeAt(i);
    if (code >= 0x80) return text;
    bytes.push(code);
    i += 1;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
  } catch {
    return text;
  }
}

export function programName(command: string): string {
  const app = /^(?:.*?\/)?([^/]+)\.app(?:\/|$)/.exec(command);
  if (app) return app[1];
  const parts = command.split("/");
  return parts[parts.length - 1] || command;
}

export function parsePs(text: string, cores: number): ProgramRow[] {
  const divisor = Math.max(1, cores);
  const rows: ProgramRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*(\d+)\s+([\d.]+)\s+(\d+)\s+(.+?)\s*$/.exec(line);
    if (!match) continue;
    rows.push({
      name: programName(decodeVis(match[4])),
      cpuPercent: Number(match[2]) / divisor,
      memoryBytes: Number(match[3]) * 1024,
    });
  }
  return rows;
}

export function parsePmset(text: string): MacBattery {
  const line = /InternalBattery[^\n]*?\t\s*(\d+)%;\s*([^;\n]+)/.exec(text);
  if (!line) return { battery: null };
  const state = line[2].trim().toLowerCase();
  const pluggedIn = /'AC Power'/.test(text) || state === "ac attached" || state === "charged";
  return {
    battery: {
      percent: Math.max(0, Math.min(100, Number(line[1]))),
      charging: state === "charging" || state === "finishing charge",
      pluggedIn,
    },
  };
}

function ioregNumber(block: string, key: string): number | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`"${escaped}"=(\\d+)`).exec(block);
  return match ? Number(match[1]) : null;
}

export function parseIoreg(text: string): MacGpu | null {
  let best: MacGpu | null = null;
  const entries = text.split(/\n(?=\+-o )/);
  for (const entry of entries) {
    const stats = /"PerformanceStatistics" = \{([^}]*)\}/.exec(entry);
    if (!stats) continue;
    const percent = ioregNumber(stats[1], "Device Utilization %");
    if (percent === null) continue;
    const model = /"model" = "([^"]*)"/.exec(entry);
    const memory = ioregNumber(stats[1], "In use system memory");
    const reading: MacGpu = {
      name: model ? model[1] : null,
      percent: Math.max(0, Math.min(100, percent)),
      memoryUsedBytes: memory,
    };
    if (!best || reading.percent > best.percent) best = reading;
  }
  return best;
}
