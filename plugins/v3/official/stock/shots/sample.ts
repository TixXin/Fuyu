import { DEFAULT_SETTINGS, type Quote, type StockItem, type StockState } from "../src/model.ts";

const NOW = Date.parse("2026-11-26T10:24:00");

type Row = [id: string, code: string, name: string, kind: string, price: number, change: number];

const rows: Row[] = [
  ["1.000001", "000001", "上证指数", "指数", 3470.86, -5.61],
  ["1.600519", "600519", "贵州茅台", "沪A", 1464.73, -10.11],
  ["0.300750", "300750", "宁德时代", "深A", 268.4, 6.12],
  ["116.00700", "00700", "腾讯控股", "港股", 341.0, 3.6],
  ["116.09988", "09988", "阿里巴巴-W", "港股", 118.5, -1.3],
  ["105.AAPL", "AAPL", "苹果", "美股", 355.58, 1.51],
  ["105.NVDA", "NVDA", "英伟达", "美股", 186.2, 0],
];

const stocks: StockItem[] = rows.map(([id, code, name, kind]) => ({ id, code, name, kind }));
const quotes: Record<string, Quote> = {};
for (const [id, , , , price, change] of rows) {
  const us = id.startsWith("105.");
  quotes[id] = {
    id,
    price,
    change,
    percent: Math.round((change / (price - change)) * 10000) / 100,
    time: us ? Date.parse("2026-11-25T16:00:00-05:00") : NOW - 30_000,
  };
}

const state: StockState = {
  settings: { ...DEFAULT_SETTINGS, stocks },
  quotes,
  status: "live",
  source: "eastmoney",
  updatedAt: NOW - 20_000,
  nextAt: NOW + 10_000,
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
