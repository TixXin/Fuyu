export type Backend = "everything" | "spotlight" | "none";

export type SearchStatus = "ok" | "no-everything" | "not-running" | "no-es" | "unsupported" | "error";

export type MacScope = "home" | "common" | "all";

export type FileKind = "dir" | "pdf" | "doc" | "sheet" | "slide" | "image" | "code" | "archive" | "other";

export interface FileHit {
  path: string;
  name: string;
  folder: string;
  isDir?: boolean;
}

export interface SearchResult {
  query: string;
  status: SearchStatus;
  backend: Backend;
  hits: FileHit[];
  truncated: boolean;
  canStart: boolean;
  message: string;
}

export interface FileSearchSettings {
  resultLimit: number;
  showRecent: boolean;
  rememberQuery: boolean;
  autoCollapse: boolean;
  macScope: MacScope;
}

export interface FileSearchState {
  settings: FileSearchSettings;
  backend: Backend;
  recent: FileHit[];
  lastQuery: string;
  homeDir: string;
  at: number;
}

export const METHODS = {
  getState: "getState",
  setSettings: "setSettings",
  recent: "recent",
  search: "search",
  lastQuery: "lastQuery",
  open: "open",
  reveal: "reveal",
  startEverything: "startEverything",
  openDownload: "openDownload",
} as const;

export const TOPICS = { state: "state" } as const;

export const RESULT_LIMIT = 50;
export const LIMIT_OPTIONS = [20, 50, 100] as const;
export const MAC_SCOPES: readonly MacScope[] = ["home", "common", "all"];
export const MAX_QUERY_LENGTH = 200;
export const WINGET_EVERYTHING = "winget install voidtools.Everything";
export const WINGET_ES = "winget install voidtools.Everything.Cli";

export const DEFAULT_SETTINGS: FileSearchSettings = {
  resultLimit: 50,
  showRecent: true,
  rememberQuery: true,
  autoCollapse: true,
  macScope: "home",
};

export function normalizeSettings(raw: unknown, base: FileSearchSettings = DEFAULT_SETTINGS): FileSearchSettings {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const limit = Number(src.resultLimit);
  return {
    resultLimit: (LIMIT_OPTIONS as readonly number[]).includes(limit) ? limit : base.resultLimit,
    showRecent: typeof src.showRecent === "boolean" ? src.showRecent : base.showRecent,
    rememberQuery: typeof src.rememberQuery === "boolean" ? src.rememberQuery : base.rememberQuery,
    autoCollapse: typeof src.autoCollapse === "boolean" ? src.autoCollapse : base.autoCollapse,
    macScope: MAC_SCOPES.includes(src.macScope as MacScope) ? (src.macScope as MacScope) : base.macScope,
  };
}

export function emptyResult(query: string, backend: Backend, status: SearchStatus = "ok"): SearchResult {
  return { query, status, backend, hits: [], truncated: false, canStart: false, message: "" };
}

export function normalizeQuery(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\r\n\t\u0000]+/g, " ").trim().slice(0, MAX_QUERY_LENGTH);
}

export function backendFor(platform: string): Backend {
  if (platform === "win32") return "everything";
  if (platform === "darwin") return "spotlight";
  return "none";
}

export function splitPath(fullPath: string, platform: string): { name: string; folder: string } {
  const trimmed = platform === "win32" ? fullPath.replace(/[\\/]+$/, "") : fullPath.replace(/\/+$/, "");
  const index = platform === "win32" ? Math.max(trimmed.lastIndexOf("\\"), trimmed.lastIndexOf("/")) : trimmed.lastIndexOf("/");
  if (index < 0) return { name: trimmed, folder: "" };
  const folder = trimmed.slice(0, index);
  return { name: trimmed.slice(index + 1), folder: folder || (platform === "win32" ? "" : "/") };
}

export function toHits(lines: readonly string[], platform: string, limit: number = RESULT_LIMIT): FileHit[] {
  const seen = new Set<string>();
  const hits: FileHit[] = [];
  for (const raw of lines) {
    const path = raw.replace(/^﻿/, "").replace(/\r$/, "").trim();
    if (!path || seen.has(path)) continue;
    seen.add(path);
    const { name, folder } = splitPath(path, platform);
    if (!name) continue;
    hits.push({ path, name, folder });
    if (hits.length >= limit) break;
  }
  return hits;
}

export function esTerms(query: string): string[] {
  return query
    .split(/\s+/)
    .map((term) => term.replace(/^[-/]+/, ""))
    .filter((term) => term.length > 0);
}

export function esArgs(query: string, limit: number = RESULT_LIMIT): string[] {
  return ["-n", String(limit + 1), "-cp", "65001", ...esTerms(query)];
}

export function mdfindArgs(query: string, scope: string | readonly string[] | null): string[] {
  const dirs = typeof scope === "string" ? (scope ? [scope] : []) : Array.isArray(scope) ? scope.filter(Boolean) : [];
  const args: string[] = [];
  for (const dir of dirs) args.push("-onlyin", dir);
  return [...args, "-name", query];
}

export interface OpenSpec {
  command: string;
  args: string[];
}

export function openSpec(target: string, platform: string, reveal: boolean): OpenSpec | null {
  if (!target) return null;
  if (platform === "darwin") return { command: "open", args: reveal ? ["-R", target] : [target] };
  if (platform === "win32") return { command: "explorer.exe", args: reveal ? [`/select,${target}`] : [target] };
  return null;
}

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return "";
  return name.slice(dot + 1, dot + 5).toUpperCase();
}

const DOC_EXTS = new Set(["DOC", "DOCX", "TXT", "MD", "RTF", "PAGE"]);
const SHEET_EXTS = new Set(["XLS", "XLSX", "CSV", "NUMB", "TSV"]);
const SLIDE_EXTS = new Set(["PPT", "PPTX", "KEY"]);
const IMAGE_EXTS = new Set(["PNG", "JPG", "JPEG", "WEBP", "GIF", "SVG", "HEIC", "BMP", "ICO"]);
const CODE_EXTS = new Set(["TS", "TSX", "JS", "JSX", "MJS", "PY", "RS", "GO", "JAVA", "JSON", "YAML", "YML", "HTML", "CSS", "SQL", "SH", "TOML"]);
const ARCHIVE_EXTS = new Set(["ZIP", "TAR", "GZ", "RAR", "7Z", "DMG", "PKG", "ISO"]);

export function fileKindOf(hit: Pick<FileHit, "name" | "isDir">): FileKind {
  if (hit.isDir) return "dir";
  const ext = extensionOf(hit.name);
  if (!ext) return "dir";
  if (ext === "PDF") return "pdf";
  if (DOC_EXTS.has(ext)) return "doc";
  if (SHEET_EXTS.has(ext)) return "sheet";
  if (SLIDE_EXTS.has(ext)) return "slide";
  if (IMAGE_EXTS.has(ext)) return "image";
  if (CODE_EXTS.has(ext)) return "code";
  if (ARCHIVE_EXTS.has(ext)) return "archive";
  return "other";
}

export function shortenFolder(folder: string, homeDir: string): string {
  if (!folder) return "";
  if (homeDir && (folder === homeDir || folder.startsWith(`${homeDir}/`) || folder.startsWith(`${homeDir}\\`))) {
    return `~${folder.slice(homeDir.length)}`;
  }
  return folder;
}
