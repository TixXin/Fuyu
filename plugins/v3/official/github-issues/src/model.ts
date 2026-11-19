export type SortKey = "updated" | "created" | "comments";

export interface IssuesSettings {
  repos: string[];
  perRepo: number;
  sort: SortKey;
  labels: string;
  includePulls: boolean;
  showAuthor: boolean;
  showUpdated: boolean;
  showComments: boolean;
  refreshOnOpen: boolean;
  showInBar: boolean;
  refreshMinutes: number;
  notifyNew: boolean;
}

export interface IssueItem {
  id: string;
  number: number;
  title: string;
  author: string;
  updatedAt: string;
  comments: number;
  url: string;
  pull: boolean;
}

export type RepoError =
  | { kind: "notFound" }
  | { kind: "rate"; resetUnix: number }
  | { kind: "failed"; message: string };

export interface RepoGroup {
  repo: string;
  items: IssueItem[];
  more: boolean;
  error: RepoError | null;
  loaded: boolean;
}

export interface IssuesState {
  settings: IssuesSettings;
  groups: RepoGroup[];
  loading: boolean;
  at: number;
}

export type AddRepoResult = { ok: true; repo: string } | { ok: false; reason: "format" | "duplicate" | "full" | "notFound" | "rate" | "failed"; message?: string };

export const PER_REPO_OPTIONS = [5, 10, 20, 30] as const;
export const SORT_OPTIONS: readonly SortKey[] = ["updated", "created", "comments"];
export const MINUTE_OPTIONS = [5, 10, 15, 30, 60, 120] as const;
export const MAX_REPOS = 20;
export const FETCH_PAGE = 50;
export const FILTER_THRESHOLD = 10;
export const SOFT_REFRESH_MS = 60_000;

export const DEFAULT_SETTINGS: IssuesSettings = {
  repos: [],
  perRepo: 10,
  sort: "updated",
  labels: "",
  includePulls: false,
  showAuthor: false,
  showUpdated: true,
  showComments: true,
  refreshOnOpen: true,
  showInBar: false,
  refreshMinutes: 15,
  notifyNew: false,
};

export const METHODS = {
  getState: "getState",
  setSettings: "setSettings",
  addRepo: "addRepo",
  removeRepo: "removeRepo",
  refresh: "refresh",
} as const;

export const TOPICS = {
  state: "state",
} as const;

const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function parseRepo(input: string): string | null {
  let text = input.trim();
  const url = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s#?]+)/i.exec(text);
  if (url) text = `${url[1]}/${url[2]}`;
  text = text.replace(/\.git$/i, "").replace(/\/+$/, "");
  return REPO_PATTERN.test(text) ? text : null;
}

export function parseReposText(input: string): string[] {
  const seen = new Set<string>();
  const repos: string[] = [];
  for (const token of input.split(/[,;\s]+/)) {
    const repo = parseRepo(token);
    if (!repo || seen.has(repo.toLowerCase())) continue;
    seen.add(repo.toLowerCase());
    if (repos.length < MAX_REPOS) repos.push(repo);
  }
  return repos;
}

export function sameRepo(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function pick<T>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function minutes(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? Math.round(value) : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(5, Math.min(120, n));
}

export function normalizeLabels(value: unknown): string {
  if (typeof value !== "string") return "";
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of value.split(",")) {
    const label = part.trim().slice(0, 50);
    if (!label || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    out.push(label);
  }
  return out.slice(0, 10).join(", ");
}

function normalizeRepos(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return parseReposText(value.filter((item): item is string => typeof item === "string").join(" "));
}

export function normalizeSettings(raw: unknown, base: IssuesSettings = DEFAULT_SETTINGS): IssuesSettings {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  let repos = base.repos;
  if (Array.isArray(src.repos)) repos = normalizeRepos(src.repos);
  else if (typeof src.reposText === "string") repos = parseReposText(src.reposText);
  return {
    repos,
    perRepo: pick(src.perRepo, PER_REPO_OPTIONS, base.perRepo as (typeof PER_REPO_OPTIONS)[number]),
    sort: pick(src.sort, SORT_OPTIONS, base.sort),
    labels: "labels" in src ? normalizeLabels(src.labels) : base.labels,
    includePulls: flag(src.includePulls, base.includePulls),
    showAuthor: flag(src.showAuthor, base.showAuthor),
    showUpdated: flag(src.showUpdated, base.showUpdated),
    showComments: flag(src.showComments, base.showComments),
    refreshOnOpen: flag(src.refreshOnOpen, base.refreshOnOpen),
    showInBar: flag(src.showInBar, base.showInBar),
    refreshMinutes: minutes(src.refreshMinutes, base.refreshMinutes),
    notifyNew: flag(src.notifyNew, base.notifyNew),
  };
}

export function queryKey(settings: IssuesSettings): string {
  return `${settings.sort}|${settings.labels}`;
}

export function visibleItems(items: readonly IssueItem[], settings: IssuesSettings): IssueItem[] {
  return settings.includePulls ? [...items] : items.filter((item) => !item.pull);
}

export function openTotal(groups: readonly RepoGroup[]): { count: number; more: boolean } {
  let count = 0;
  let more = false;
  for (const group of groups) {
    count += group.items.length;
    if (group.more) more = true;
  }
  return { count, more };
}

export function matchesFilter(item: IssueItem, keyword: string): boolean {
  if (!keyword) return true;
  return item.title.toLowerCase().includes(keyword) || `#${item.number}`.includes(keyword);
}

export function relativeAge(iso: string, at: number): { unit: "now" | "minute" | "hour" | "day" | "month" | "year"; n: number } | null {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return null;
  const minutesAgo = Math.max(0, Math.floor((at - time) / 60_000));
  if (minutesAgo < 1) return { unit: "now", n: 0 };
  if (minutesAgo < 60) return { unit: "minute", n: minutesAgo };
  const hours = Math.floor(minutesAgo / 60);
  if (hours < 24) return { unit: "hour", n: hours };
  const days = Math.floor(hours / 24);
  if (days < 30) return { unit: "day", n: days };
  if (days < 365) return { unit: "month", n: Math.floor(days / 30) };
  return { unit: "year", n: Math.floor(days / 365) };
}

export function effectiveMinutes(settings: IssuesSettings, budgetPerHour: number): number {
  const count = settings.repos.length;
  if (count <= 0) return settings.refreshMinutes;
  return Math.max(settings.refreshMinutes, Math.ceil((count * 60) / budgetPerHour));
}
