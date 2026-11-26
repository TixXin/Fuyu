import { currentLocale } from "./locale.ts";

const en = {
  title: "Stocks",
  refresh: "Refresh",
  refreshing: "Refreshing…",
  noStocks: "No stocks on your watchlist yet.",
  noStocksHint: "Add them in Settings → Plugins → Stocks.",
  goSettings: "Add in settings",
  status: {
    idle: "",
    live: "Trading",
    closed: "Market closed",
    holiday: "Market looks closed today",
    offline: "Can't get quotes right now; showing the last ones",
  },
  updated: (clock: string) => `Updated ${clock}`,
  nextAt: (clock: string) => `next update ${clock}`,
  quoteTime: (clock: string) => `Quote time ${clock}`,
  noQuote: "No quote",
  source: { eastmoney: "Eastmoney", tencent: "Tencent" } as Record<"eastmoney" | "tencent", string>,
  sourceNote: (name: string) => `Data: ${name}. Quotes may be delayed; not investment advice.`,
  watchlistTitle: "Watchlist",
  watchlistHint: "Search by code, name or pinyin initials. A-shares, Hong Kong and US stocks, indexes and ETFs. Up to 20.",
  searchPlaceholder: "600519, Tencent, AAPL…",
  search: "Search",
  searching: "Searching…",
  noResults: "Nothing found.",
  searchFailed: "Couldn't search. Check the connection and try again.",
  add: "Add",
  added: "Added",
  remove: "Remove",
  moveUp: "Move up",
  moveDown: "Move down",
  addErrors: {
    invalid: "That item can't be added.",
    duplicate: "It's already on the watchlist.",
    full: "You can watch up to 20.",
  },
  colorsTitle: "Colors",
  colorScheme: "Up and down",
  redUp: "Red up, green down",
  greenUp: "Green up, red down",
  refreshTitle: "Refresh",
  refreshEvery: "While trading, refresh every",
  seconds: (n: number) => (n >= 60 ? `${n / 60} min` : `${n} s`),
  refreshHint: "Quotes only refresh while a market on your watchlist is open; outside trading hours nothing is fetched.",
  refreshOnOpen: "Refresh when the page opens",
  barSection: "Collapsed bar",
  showInBar: "Show the watchlist on the collapsed bar",
  barMode: "Show",
  barRotate: "One after another",
  barFixed: "First one only",
  barSeconds: "Switch every",
  barPrice: "Show the price too",
};

const zhCN: typeof en = {
  title: "自选股",
  refresh: "刷新",
  refreshing: "正在刷新…",
  noStocks: "还没有自选股。",
  noStocksHint: "在「设置 → 插件 → 自选股」里添加。",
  goSettings: "去设置里添加",
  status: {
    idle: "",
    live: "交易中",
    closed: "已休市",
    holiday: "今天像是休市",
    offline: "暂时取不到行情，显示的是上次的",
  },
  updated: (clock: string) => `${clock} 更新`,
  nextAt: (clock: string) => `下次 ${clock}`,
  quoteTime: (clock: string) => `行情时间 ${clock}`,
  noQuote: "暂无行情",
  source: { eastmoney: "东方财富", tencent: "腾讯" },
  sourceNote: (name: string) => `数据来自${name}，可能有延时，不构成投资建议。`,
  watchlistTitle: "自选股",
  watchlistHint: "按代码、名称或拼音首字母搜索，支持 A 股、港股、美股、指数和 ETF，最多 20 只。",
  searchPlaceholder: "600519、腾讯、AAPL…",
  search: "搜索",
  searching: "正在搜索…",
  noResults: "没有找到。",
  searchFailed: "搜索失败，检查网络后再试。",
  add: "添加",
  added: "已添加",
  remove: "删除",
  moveUp: "上移",
  moveDown: "下移",
  addErrors: {
    invalid: "这一项加不了。",
    duplicate: "已经在自选股里了。",
    full: "最多 20 只。",
  },
  colorsTitle: "颜色",
  colorScheme: "涨跌颜色",
  redUp: "红涨绿跌",
  greenUp: "绿涨红跌",
  refreshTitle: "刷新",
  refreshEvery: "交易时段每隔",
  seconds: (n: number) => (n >= 60 ? `${n / 60} 分钟` : `${n} 秒`),
  refreshHint: "只在自选股所在的市场开盘时刷新，休市时不联网。",
  refreshOnOpen: "打开页面时立即刷新",
  barSection: "收起条",
  showInBar: "在收起条上显示自选股",
  barMode: "显示方式",
  barRotate: "轮流显示",
  barFixed: "只显示第一只",
  barSeconds: "每只停留",
  barPrice: "同时显示现价",
};

export const text = currentLocale() === "zh-CN" ? zhCN : en;

export const PAGE_TITLE = { "zh-CN": zhCN.title, en: en.title };

export const SETUP_HINT = { "zh-CN": "添加自选股", en: "Add stocks to watch" };

export function clock(at: number): string {
  const date = new Date(at);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function quoteClock(at: number, now: number): string {
  const date = new Date(at);
  const today = new Date(now);
  const sameDay = date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
  return sameDay ? clock(at) : `${date.getMonth() + 1}/${date.getDate()} ${clock(at)}`;
}
