import type { IssueItem, RateInfo } from "./types.ts";

interface RawGitHubIssue {
  number?: number;
  title?: string;
  html_url?: string;
  updated_at?: string;
  comments?: number;
  pull_request?: unknown;
  user?: {
    login?: string;
  };
}

export interface RepoFetchAnswer {
  status: number;
  items: IssueItem[] | null;
  etag: string | null;
  rate: RateInfo | null;
  errorMessage: string | null;
}

function readRate(headers: Headers): RateInfo | null {
  const rem = headers.get("x-ratelimit-remaining");
  const lim = headers.get("x-ratelimit-limit");
  const rst = headers.get("x-ratelimit-reset");
  if (rem === null || lim === null || rst === null) return null;
  const remaining = Number(rem);
  const limit = Number(lim);
  const resetUnix = Number(rst);
  if (!Number.isFinite(remaining) || !Number.isFinite(limit) || !Number.isFinite(resetUnix)) {
    return null;
  }
  return { remaining, limit, resetUnix };
}

export async function fetchRepoIssues(repo: string, etag: string | null): Promise<RepoFetchAnswer> {
  const [owner, repoName] = repo.split("/", 2);
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/issues?state=open&per_page=30`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (etag) {
    headers["If-None-Match"] = etag;
  }

  const response = await fetch(url, { headers });
  const rate = readRate(response.headers);
  const nextEtag = response.headers.get("etag");

  if (response.status === 304) {
    return { status: 304, items: null, etag: etag, rate, errorMessage: null };
  }

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string };
      if (typeof body?.message === "string" && body.message.trim() !== "") {
        message = body.message.trim();
      }
    } catch {
      message = `HTTP ${response.status}`;
    }
    return { status: response.status, items: null, etag: null, rate, errorMessage: message };
  }

  const data = (await response.json()) as RawGitHubIssue[];
  const list = Array.isArray(data) ? data : [];
  const items: IssueItem[] = [];
  for (const raw of list) {
    if (raw.pull_request !== undefined && raw.pull_request !== null) continue;
    if (typeof raw.number !== "number" || typeof raw.title !== "string") continue;
    const updatedDate =
      typeof raw.updated_at === "string" && raw.updated_at.length >= 10
        ? raw.updated_at.slice(0, 10)
        : "";
    items.push({
      id: `${repo}#${raw.number}`,
      number: raw.number,
      title: raw.title,
      author: typeof raw.user?.login === "string" ? raw.user.login : "",
      updatedDate,
      comments: typeof raw.comments === "number" ? raw.comments : 0,
      url: typeof raw.html_url === "string" ? raw.html_url : "",
    });
  }

  return {
    status: 200,
    items,
    etag: nextEtag ?? etag,
    rate,
    errorMessage: null,
  };
}
