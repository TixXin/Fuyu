import { PROGRAMS_LIMIT, type ProgramReading, type ProgramsReading } from "../protocol.ts";

export interface ProgramRow {
  name: string;
  cpuPercent: number;
  memoryBytes: number;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function rankPrograms(rows: readonly ProgramRow[], limit = PROGRAMS_LIMIT): ProgramsReading {
  const merged = new Map<string, ProgramReading>();
  for (const row of rows) {
    const name = row.name.trim();
    if (!name) continue;
    const entry = merged.get(name) ?? { name, count: 0, cpuPercent: 0, memoryBytes: 0 };
    entry.count += 1;
    entry.cpuPercent += Number.isFinite(row.cpuPercent) ? Math.max(0, row.cpuPercent) : 0;
    entry.memoryBytes += Number.isFinite(row.memoryBytes) ? Math.max(0, row.memoryBytes) : 0;
    merged.set(name, entry);
  }
  const list = [...merged.values()].map((entry) => ({
    ...entry,
    cpuPercent: round1(Math.min(100, entry.cpuPercent)),
  }));
  const byName = (a: ProgramReading, b: ProgramReading) => a.name.localeCompare(b.name);
  const byCpu = [...list]
    .sort((a, b) => b.cpuPercent - a.cpuPercent || b.memoryBytes - a.memoryBytes || byName(a, b))
    .slice(0, limit);
  const byMemory = [...list]
    .sort((a, b) => b.memoryBytes - a.memoryBytes || b.cpuPercent - a.cpuPercent || byName(a, b))
    .slice(0, limit);
  return { byCpu, byMemory };
}
