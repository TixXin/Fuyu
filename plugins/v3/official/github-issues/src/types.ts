export type Locale = "zh-CN" | "en";

export interface IssuesConfig {
  reposText: string;
  refreshMinutes: number;
  notifyNew: boolean;
  locale: Locale;
}

export interface IssueItem {
  id: string;
  number: number;
  title: string;
  author: string;
  updatedDate: string;
  comments: number;
  url: string;
}

export interface RepoGroup {
  repo: string;
  items: IssueItem[];
  error: string | null;
  loaded: boolean;
}

export interface RateInfo {
  remaining: number;
  limit: number;
  resetUnix: number;
}

export interface IssuesState {
  config: IssuesConfig;
  repos: string[];
  invalidRepos: string[];
  groups: RepoGroup[];
  rate: RateInfo | null;
  loading: boolean;
  updatedAt: number;
}

export const DEFAULT_CONFIG: IssuesConfig = {
  reposText: "",
  refreshMinutes: 15,
  notifyNew: false,
  locale: "zh-CN",
};

export const METHODS = {
  getState: "getState",
  setConfig: "setConfig",
  refresh: "refresh",
} as const;

export const TOPICS = {
  state: "state",
} as const;

const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const MAX_REPOS = 20;

export function parseRepos(input: string): { repos: string[]; invalidRepos: string[] } {
  const tokens = input
    .split(/[,;\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const repos: string[] = [];
  const invalidRepos: string[] = [];
  for (const token of tokens) {
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (REPO_PATTERN.test(token)) {
      if (repos.length < MAX_REPOS) repos.push(token);
    } else {
      invalidRepos.push(token);
    }
  }
  return { repos, invalidRepos };
}

export function detectLocale(): Locale {
  if (typeof navigator !== "undefined" && /^zh\b/i.test(navigator.language)) {
    return "zh-CN";
  }
  return "en";
}

export const TEXT = {
  "zh-CN": {
    title: "GitHub Issue",
    reposLabel: "仓库列表（owner/repo，多个用逗号或空格分隔）",
    reposPlaceholder: "如：TixXin/fuyu, facebook/react",
    refreshMinutes: "刷新间隔（分钟）",
    notifyNew: "发现新公开 Issue 时在岛上提醒",
    save: "保存设置",
    refresh: "立即刷新",
    loading: "加载中…",
    filterPlaceholder: "筛选 issue 标题或编号…",
    emptyTitle: "尚未配置仓库",
    emptyBody: "请在设置分节填写一个或多个 owner/repo 公开仓库名称。",
    noOpenIssues: "暂无未关闭的 issue",
    openCount: (count: number) => `${count} 条未关闭`,
    notFound: "找不到该仓库或无访问权限",
    rateExhausted: (clock: string) => `本小时请求额度已用完，${clock} 后恢复`,
    loadFailed: (msg: string) => `加载失败：${msg}`,
    invalidRepos: (bad: string[]) => `格式有误（需为 owner/repo）：${bad.join(", ")}`,
    newIssueTitle: (repo: string) => `${repo} 有新 Issue`,
  },
  en: {
    title: "GitHub issues",
    reposLabel: "Repositories (owner/repo, separated by commas or spaces)",
    reposPlaceholder: "e.g. TixXin/fuyu, facebook/react",
    refreshMinutes: "Refresh interval (minutes)",
    notifyNew: "Notify on the island when new public issues appear",
    save: "Save settings",
    refresh: "Refresh now",
    loading: "Loading…",
    filterPlaceholder: "Filter by issue title or number…",
    emptyTitle: "No repositories configured",
    emptyBody: "Enter one or more public owner/repo repositories in Settings.",
    noOpenIssues: "No open issues",
    openCount: (count: number) => `${count} open`,
    notFound: "Repository not found or private",
    rateExhausted: (clock: string) => `Hourly rate limit reached; resets after ${clock}`,
    loadFailed: (msg: string) => `Failed to load: ${msg}`,
    invalidRepos: (bad: string[]) => `Invalid format (use owner/repo): ${bad.join(", ")}`,
    newIssueTitle: (repo: string) => `New issue in ${repo}`,
  },
} as const;
