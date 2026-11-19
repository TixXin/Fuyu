import { FETCH_PAGE, type IssueItem, type SortKey } from "./model.ts";

export interface RateInfo {
  remaining: number;
  limit: number;
  resetUnix: number;
}

interface RawGitHubIssue {
  number?: number;
  title?: string;
  html_url?: string;
  updated_at?: string;
  comments?: number;
  pull_request?: unknown;
  repository_url?: string;
  user?: { login?: string };
}

export interface RepoFetchAnswer {
  status: number;
  items: IssueItem[] | null;
  more: boolean;
  etag: string | null;
  rate: RateInfo | null;
  moved: boolean;
  movedTo: string | null;
  errorMessage: string | null;
}

export interface RepoInfoAnswer {
  status: number;
  fullName: string | null;
  rate: RateInfo | null;
  errorMessage: string | null;
}

const HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

const MOVED = new Set([301, 302, 307, 308]);

function readRate(headers: Headers): RateInfo | null {
  const rem = headers.get("x-ratelimit-remaining");
  const lim = headers.get("x-ratelimit-limit");
  const rst = headers.get("x-ratelimit-reset");
  if (rem === null || lim === null || rst === null) return null;
  const remaining = Number(rem);
  const limit = Number(lim);
  const resetUnix = Number(rst);
  if (!Number.isFinite(remaining) || !Number.isFinite(limit) || !Number.isFinite(resetUnix)) return null;
  return { remaining, limit, resetUnix };
}

async function errorMessageOf(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string };
    if (typeof body?.message === "string" && body.message.trim() !== "") return body.message.trim();
  } catch {
    return `HTTP ${response.status}`;
  }
  return `HTTP ${response.status}`;
}

async function getFollowing(url: string, headers: Record<string, string>): Promise<{ response: Response; moved: boolean }> {
  let response = await fetch(url, { headers });
  let moved = response.redirected;
  for (let hops = 0; hops < 3 && MOVED.has(response.status); hops += 1) {
    const location = response.headers.get("location");
    if (!location) break;
    moved = true;
    response = await fetch(new URL(location, url).toString(), { headers });
  }
  return { response, moved };
}

function repoPath(repo: string): string {
  const [owner, name] = repo.split("/", 2);
  return `${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
}

export function repoFromApiUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const match = /\/repos\/([^/]+\/[^/?#]+)$/.exec(url);
  return match ? decodeURIComponent(match[1]) : null;
}

export function issuesUrl(repo: string, sort: SortKey, labels: string): string {
  const params = new URLSearchParams({ state: "open", sort, direction: "desc", per_page: String(FETCH_PAGE) });
  const list = labels
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean);
  if (list.length > 0) params.set("labels", list.join(","));
  return `https://api.github.com/repos/${repoPath(repo)}/issues?${params.toString()}`;
}

function toItem(repo: string, raw: RawGitHubIssue): IssueItem | null {
  if (typeof raw.number !== "number" || typeof raw.title !== "string") return null;
  return {
    id: `${repo}#${raw.number}`,
    number: raw.number,
    title: raw.title,
    author: typeof raw.user?.login === "string" ? raw.user.login : "",
    updatedAt: typeof raw.updated_at === "string" ? raw.updated_at : "",
    comments: typeof raw.comments === "number" ? raw.comments : 0,
    url: typeof raw.html_url === "string" ? raw.html_url : "",
    pull: raw.pull_request !== undefined && raw.pull_request !== null,
  };
}

export async function fetchRepoIssues(repo: string, sort: SortKey, labels: string, etag: string | null): Promise<RepoFetchAnswer> {
  const headers: Record<string, string> = { ...HEADERS };
  if (etag) headers["If-None-Match"] = etag;
  const { response, moved } = await getFollowing(issuesUrl(repo, sort, labels), headers);
  const rate = readRate(response.headers);
  const base = { more: false, rate, moved, movedTo: null };

  if (response.status === 304) {
    return { ...base, status: 304, items: null, etag, errorMessage: null };
  }
  if (!response.ok) {
    return { ...base, status: response.status, items: null, etag: null, errorMessage: await errorMessageOf(response) };
  }

  const data = (await response.json()) as RawGitHubIssue[];
  const list = Array.isArray(data) ? data : [];
  const items: IssueItem[] = [];
  for (const raw of list) {
    const item = toItem(repo, raw);
    if (item) items.push(item);
  }
  const movedTo = moved ? repoFromApiUrl(list[0]?.repository_url) : null;
  return {
    ...base,
    status: 200,
    items,
    more: list.length >= FETCH_PAGE,
    movedTo,
    etag: response.headers.get("etag") ?? etag,
    errorMessage: null,
  };
}

export async function fetchRepoInfo(repo: string): Promise<RepoInfoAnswer> {
  const { response } = await getFollowing(`https://api.github.com/repos/${repoPath(repo)}`, { ...HEADERS });
  const rate = readRate(response.headers);
  if (!response.ok) {
    return { status: response.status, fullName: null, rate, errorMessage: await errorMessageOf(response) };
  }
  const body = (await response.json()) as { full_name?: unknown; private?: unknown };
  const fullName = typeof body?.full_name === "string" ? body.full_name : null;
  return { status: 200, fullName, rate, errorMessage: null };
}
