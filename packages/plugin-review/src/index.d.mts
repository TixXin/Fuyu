export type Tier = "green" | "yellow" | "red";
export type FindingTier = "red" | "yellow" | "info";
export type Check = "release" | "manifest" | "nodeApis" | "network" | "dependencies" | "sensitive" | "obfuscation" | "files" | "size";

export interface Location {
  file: string;
  line: number;
}

export interface Finding {
  tier: FindingTier;
  check: Check;
  message: string;
  detail?: string;
  file?: string;
  line?: number;
  snippet?: string;
  kind?: string;
  lines?: number[];
  locations?: Location[];
}

export interface PackageChange {
  name: string;
  versions: string[];
}

export interface DependencySummary {
  declared: { field: string; name: string; from: string | null; to: string | null }[];
  lockfile: string | null;
  added: PackageChange[];
  removed: PackageChange[];
  changed: { name: string; from: string[]; to: string[] }[];
  tampered: { name: string; version: string; from: string; to: string }[];
  installScripts: { name: string; version: string }[];
}

export interface Report {
  format: "fuyu-plugin-review/1";
  tier: Tier;
  plugin: { name: string | null; from: string | null; to: string | null };
  firstRelease: boolean;
  findings: Finding[];
  summary: {
    nodeApis: { all: string[]; added: string[]; removed: string[]; declared: string[] | null };
    network: { declared: string[]; used: string[]; added: string[]; undeclared: string[] };
    dependencies: DependencySummary;
    manifest: { provides: string[]; replaces: string[]; experimental: string[] };
    files: { added: string[]; removed: string[]; changed: string[] };
    lines: { added: number; removed: number; threshold: number };
    binaries: { file: string; kind: string; label?: string; size: number }[];
    built: boolean;
  };
}

export interface ReviewOptions {
  oldDir?: string | null;
  newDir: string;
  oldBuilt?: string | null;
  newBuilt?: string | null;
}

export interface LockEntry {
  name: string;
  version: string;
  integrity?: string;
  resolved?: string;
  installScript?: boolean;
}

export interface CodeScan {
  modules: { name: string; specifier: string; line: number }[];
  domains: { domain: string; line: number; concatenated: boolean }[];
  sensitive: { kind: string; line: number; snippet: string; detail?: string }[];
  obfuscation: { kind: string; severity: "red" | "yellow"; line: number; snippet: string; detail?: string }[];
}

export interface Writable {
  write(chunk: string): unknown;
}

export declare const FORMAT: "fuyu-plugin-review/1";
export declare const LINE_THRESHOLD: number;
export declare function review(options: ReviewOptions): Report;
export declare function compareVersions(previous: unknown, next: unknown): Report;
export declare function scanVersion(dir: string, builtDir?: string | null): unknown;
export declare function scanCode(text: string): CodeScan;
export declare function executableKind(data: Uint8Array): "PE" | "ELF" | "Mach-O" | "Java class" | "WebAssembly" | "Java archive" | null;
export declare function renderMarkdown(report: Report): string;
export declare function parsePackageLock(text: string): Map<string, LockEntry>;
export declare function parsePnpmLock(text: string): Map<string, LockEntry>;
export declare function diffLockfiles(before: Map<string, LockEntry>, after: Map<string, LockEntry>): Omit<DependencySummary, "declared" | "lockfile">;
export declare function run(argv: string[], io?: { stdout: Writable; stderr: Writable }): number;
