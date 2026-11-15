import { releaseNoteLines, type ReleaseNoteLine } from "./releaseNotes.ts";

export type ParsedVersion = { major: number; minor: number; patch: number; beta: number | null };

export type ReleaseEntry = { version: string; date: string | null };

export type ReleaseGroup<T extends ReleaseEntry> = { base: string; stable: T | null; betas: T[] };

const VERSION = /^v?(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/;
const NOTE_PATH = /\/v(\d+\.\d+\.\d+(?:-beta\.\d+)?)\.md$/;
const SKIPPED_HEADING = /^(关于这个版本|about this release|下载)$/i;
const CHANGES_HEADING = /^(更新内容|what's new)$/i;

export function parseVersion(version: string): ParsedVersion | null {
  const match = version.trim().match(VERSION);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), beta: match[4] === undefined ? null : Number(match[4]) };
}

export function compareVersions(a: ParsedVersion, b: ParsedVersion) {
  const core = a.major - b.major || a.minor - b.minor || a.patch - b.patch;
  if (core !== 0) return core;
  if (a.beta === b.beta) return 0;
  if (a.beta === null) return 1;
  if (b.beta === null) return -1;
  return a.beta - b.beta;
}

export function versionOfNotePath(path: string) {
  return path.match(NOTE_PATH)?.[1] ?? null;
}

export function baseVersion(version: ParsedVersion) {
  return `${version.major}.${version.minor}.${version.patch}`;
}

export function releaseGroups<T extends ReleaseEntry>(entries: readonly T[], current: string): ReleaseGroup<T>[] {
  const ceiling = parseVersion(current);
  const parsed = entries
    .map((entry) => ({ entry, version: parseVersion(entry.version) }))
    .filter((item): item is { entry: T; version: ParsedVersion } => item.version !== null)
    .filter((item) => !ceiling || compareVersions(item.version, ceiling) <= 0)
    .sort((a, b) => compareVersions(b.version, a.version));
  const groups = new Map<string, ReleaseGroup<T>>();
  for (const { entry, version } of parsed) {
    const base = baseVersion(version);
    const group = groups.get(base) ?? { base, stable: null, betas: [] };
    if (version.beta === null) group.stable = entry;
    else group.betas.push(entry);
    groups.set(base, group);
  }
  return [...groups.values()];
}

export function historyNoteLines(notes: string, locale: "zh-CN" | "en"): ReleaseNoteLine[] {
  const lines: ReleaseNoteLine[] = [];
  let skipping = false;
  for (const line of releaseNoteLines(notes, locale)) {
    if (line.kind === "heading") skipping = SKIPPED_HEADING.test(line.text);
    if (!skipping) lines.push(line);
  }
  return lines[0]?.kind === "heading" && CHANGES_HEADING.test(lines[0].text) ? lines.slice(1) : lines;
}
