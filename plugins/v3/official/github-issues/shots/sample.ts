import { DEFAULT_SETTINGS, type IssueItem, type IssuesState, type RepoGroup } from "../src/model.ts";

const NOW = Date.parse("2026-11-19T10:24:00");
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

type Row = [number: number, title: string, ago: number, comments: number, author: string];

function group(repo: string, rows: Row[]): RepoGroup {
  const items: IssueItem[] = rows.map(([number, title, ago, comments, author]) => ({
    id: `${repo}#${number}`,
    number,
    title,
    author,
    updatedAt: new Date(NOW - ago).toISOString(),
    comments,
    url: `#${repo}/issues/${number}`,
    pull: false,
  }));
  return { repo, items, more: false, error: null, loaded: true };
}

const groups: RepoGroup[] = [
  group("acme/web-app", [
    [1284, "登录页在 Safari 17 下验证码输入框无法聚焦", 35 * MINUTE, 5, "lin-yue"],
    [1279, "Dark mode: chart tooltips are unreadable on hover", 3 * HOUR, 3, "mkowalski"],
    [1262, "导出 CSV 时中文列名变成乱码", DAY + 2 * HOUR, 12, "zhou-ran"],
  ]),
  group("acme/design-system", [
    [412, "Button 在 loading 状态下宽度会跳动", 2 * HOUR, 2, "chen-xi"],
    [407, "DatePicker should respect the locale's first day of the week", DAY + 5 * HOUR, 6, "tomasz-w"],
    [398, "Tooltip 在滚动容器里位置偏移", 4 * DAY, 1, "lin-yue"],
    [391, "Document the spacing tokens for compact density", 6 * DAY, 4, "sara-b"],
  ]),
  group("acme/cli", [
    [96, "`acme deploy` hangs when the config file is missing", 6 * HOUR, 4, "mkowalski"],
    [93, "Windows 下路径带空格时 init 失败", 2 * DAY, 7, "zhou-ran"],
    [88, "Support reading the token from an environment variable", 9 * DAY, 3, "tomasz-w"],
    [81, "补充 `acme logs --follow` 的使用文档", 12 * DAY, 2, "chen-xi"],
  ]),
];

const state: IssuesState = {
  settings: {
    ...DEFAULT_SETTINGS,
    repos: groups.map((item) => item.repo),
    showInBar: true,
  },
  groups,
  loading: false,
  at: NOW,
};

export default {
  now: NOW,
  host: {
    calls: {
      getState: state,
      refresh: state,
    },
  },
  shots: [
    { slot: "island.page/v1", file: "page.png" },
    { slot: "island.collapsed/v1", file: "bar.png" },
  ],
};
