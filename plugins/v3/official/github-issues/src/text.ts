import { currentLocale } from "./locale.ts";
import type { relativeAge } from "./model.ts";

type Age = NonNullable<ReturnType<typeof relativeAge>>;

const en = {
  isZh: false,
  title: "GitHub Issues",
  refresh: "Refresh",
  refreshing: "Refreshing…",
  filterPlaceholder: "Filter by title or number",
  noRepos: "No repositories yet.",
  noReposHint: "Add the repositories you follow in Settings → Plugins → GitHub Issues.",
  goSettings: "Add in settings",
  noOpenIssues: "No open issues",
  noMatch: "Nothing matches the filter",
  loadingRepo: "Loading…",
  count: (n: number, more: boolean) => `${n}${more ? "+" : ""}`,
  showMore: (n: number) => `${n} more`,
  showLess: "Show less",
  pr: "PR",
  comments: (n: number) => (n === 1 ? "1 comment" : `${n} comments`),
  notFound: "Repository not found, or it is private",
  rateExhausted: (clock: string) => `GitHub's hourly limit is used up; it resets at ${clock}`,
  loadFailed: (msg: string) => `Couldn't load: ${msg}`,
  age: (age: Age) => {
    if (age.unit === "now") return "just now";
    const unit = { minute: "min", hour: "h", day: "d", month: "mo", year: "y" }[age.unit];
    return `${age.n}${unit} ago`;
  },
  barTitle: (n: number) => `${n} open`,
  reposTitle: "Repositories",
  reposHint: "Public repositories only. Paste owner/repo or a GitHub link.",
  addPlaceholder: "owner/repo",
  add: "Add",
  checking: "Checking…",
  remove: "Remove",
  addErrors: {
    format: "Use the form owner/repo, such as TixXin/fuyu.",
    duplicate: "That repository is already in the list.",
    full: "You can follow up to 20 repositories.",
    notFound: "That repository doesn't exist, or it is private.",
    rate: "GitHub's hourly limit is used up. Try again later.",
    failed: "Couldn't reach GitHub. Check the connection and try again.",
  },
  listTitle: "List",
  perRepo: "Issues per repository",
  sort: "Order",
  sortUpdated: "Recently updated",
  sortCreated: "Newest",
  sortComments: "Most comments",
  labels: "Only with labels",
  labelsHint: "Comma-separated; an issue needs all of them. Leave empty for all.",
  labelsPlaceholder: "bug, help wanted",
  includePulls: "Include pull requests",
  rowTitle: "Each row",
  showUpdated: "Last updated (3d ago)",
  showComments: "Comment count",
  showAuthor: "Author",
  refreshTitle: "Refresh",
  refreshMinutes: "Refresh every",
  minutes: (n: number) => `${n} min`,
  refreshOnOpen: "Refresh when the page opens",
  notifyNew: "Notify on the island about new issues",
  barSection: "Collapsed bar",
  showInBar: "Show the number of open issues",
};

const zhCN: typeof en = {
  isZh: true,
  title: "GitHub Issues",
  refresh: "刷新",
  refreshing: "正在刷新…",
  filterPlaceholder: "按标题或编号筛选",
  noRepos: "还没有关注的仓库。",
  noReposHint: "在「设置 → 插件 → GitHub Issues」里添加要关注的仓库。",
  goSettings: "去设置里添加",
  noOpenIssues: "没有未关闭的 issue",
  noMatch: "没有符合筛选的 issue",
  loadingRepo: "加载中…",
  count: (n: number, more: boolean) => `${n}${more ? "+" : ""}`,
  showMore: (n: number) => `还有 ${n} 条`,
  showLess: "收起",
  pr: "PR",
  comments: (n: number) => `${n} 条评论`,
  notFound: "找不到这个仓库，或它是私有仓库",
  rateExhausted: (clock: string) => `GitHub 每小时的请求额度用完了，${clock} 恢复`,
  loadFailed: (msg: string) => `加载失败：${msg}`,
  age: (age: Age) => {
    if (age.unit === "now") return "刚刚";
    const unit = { minute: "分钟", hour: "小时", day: "天", month: "个月", year: "年" }[age.unit];
    return `${age.n} ${unit}前`;
  },
  barTitle: (n: number) => `${n} 条未关闭`,
  reposTitle: "仓库",
  reposHint: "只支持公开仓库。填 owner/repo，或直接粘贴 GitHub 链接。",
  addPlaceholder: "owner/repo",
  add: "添加",
  checking: "正在核对…",
  remove: "删除",
  addErrors: {
    format: "格式是 owner/repo，例如 TixXin/fuyu。",
    duplicate: "这个仓库已经在列表里了。",
    full: "最多关注 20 个仓库。",
    notFound: "找不到这个仓库，或它是私有仓库。",
    rate: "GitHub 每小时的请求额度用完了，过一会儿再试。",
    failed: "连不上 GitHub，检查网络后再试。",
  },
  listTitle: "列表",
  perRepo: "每个仓库显示几条",
  sort: "排序",
  sortUpdated: "最近更新",
  sortCreated: "最新创建",
  sortComments: "评论最多",
  labels: "只看带这些标签的",
  labelsHint: "用逗号分隔，要同时带上所有标签；留空表示不筛选。",
  labelsPlaceholder: "bug, help wanted",
  includePulls: "包含 PR",
  rowTitle: "每行显示",
  showUpdated: "更新时间（3 天前）",
  showComments: "评论数",
  showAuthor: "作者",
  refreshTitle: "刷新",
  refreshMinutes: "刷新间隔",
  minutes: (n: number) => `${n} 分钟`,
  refreshOnOpen: "打开页面时立即刷新",
  notifyNew: "有新 issue 时在岛上提醒",
  barSection: "收起条",
  showInBar: "显示未关闭的总数",
};

export const text = currentLocale() === "zh-CN" ? zhCN : en;

export const PAGE_TITLE = { "zh-CN": zhCN.title, en: en.title };

export const SETUP_HINT = { "zh-CN": "添加要关注的仓库", en: "Add a repository to follow" };

export function hostText() {
  const isZh = currentLocale() === "zh-CN";
  return {
    newIssueTitle: (repo: string) => (isZh ? `${repo} 有新 issue` : `New issue in ${repo}`),
  };
}
