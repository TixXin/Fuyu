export type Backend = "everything" | "spotlight" | "none";

export type SearchStatus = "ok" | "no-everything" | "not-running" | "no-es" | "unsupported" | "error";

export interface FileHit {
  path: string;
  name: string;
  folder: string;
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

export const METHODS = {
  search: "search",
  lastQuery: "lastQuery",
  open: "open",
  reveal: "reveal",
  startEverything: "startEverything",
  openDownload: "openDownload",
} as const;

export const RESULT_LIMIT = 50;
export const MAX_QUERY_LENGTH = 200;
export const WINGET_EVERYTHING = "winget install voidtools.Everything";
export const WINGET_ES = "winget install voidtools.Everything.Cli";

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

export function mdfindArgs(query: string, scope: string | null): string[] {
  const args = scope ? ["-onlyin", scope] : [];
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
