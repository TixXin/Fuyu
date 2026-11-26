import { DEFAULT_SETTINGS, type Quote, type StockItem, type StockState, type TrendSeries } from "../src/model.ts";

const NOW = Date.parse("2026-11-26T10:24:00");

type Row = [id: string, code: string, name: string, kind: string, price: number, change: number, curve: number[]];

const rows: Row[] = [
  [
    "1.000001",
    "000001",
    "上证指数",
    "指数",
    3475.46,
    -1.01,
    [3490.1, 3488.4, 3485.2, 3486.9, 3482.3, 3479.8, 3483.1, 3477.5, 3474.2, 3470.8, 3472.6, 3476.1, 3473.9, 3475.46],
  ],
  [
    "1.600519",
    "600519",
    "贵州茅台",
    "沪A",
    1465.19,
    -9.65,
    [1470.0, 1468.2, 1465.1, 1463.4, 1466.0, 1461.8, 1458.5, 1460.2, 1462.7, 1464.1, 1463.2, 1465.19],
  ],
  [
    "116.00700",
    "00700",
    "腾讯控股",
    "港股",
    344.2,
    6.8,
    [338.4, 339.1, 338.8, 340.5, 341.2, 340.6, 342.4, 343.1, 342.8, 343.9, 344.6, 344.2],
  ],
  [
    "105.AAPL",
    "AAPL",
    "苹果",
    "美股",
    355.58,
    1.51,
    [353.5, 353.8, 354.2, 353.9, 354.6, 355.1, 354.8, 355.4, 355.9, 355.58],
  ],
  [
    "105.NVDA",
    "NVDA",
    "英伟达",
    "美股",
    186.2,
    3.42,
    [183.1, 183.5, 184.0, 183.7, 184.8, 185.4, 185.1, 186.0, 186.5, 186.2],
  ],
  [
    "0.300750",
    "300750",
    "宁德时代",
    "深A",
    256.4,
    5.22,
    [252.0, 250.8, 252.4, 254.1, 255.6, 257.2, 258.5, 257.1, 256.8, 256.4],
  ],
];

const stocks: StockItem[] = rows.map(([id, code, name, kind]) => ({ id, code, name, kind }));
const quotes: Record<string, Quote> = {};
const trends: Record<string, TrendSeries> = {};
for (const [id, , , , price, change, curve] of rows) {
  const us = id.startsWith("105.");
  const preClose = Math.round((price - change) * 100) / 100;
  quotes[id] = {
    id,
    price,
    change,
    percent: Math.round((change / preClose) * 10000) / 100,
    time: us ? Date.parse("2026-11-25T16:00:00-05:00") : NOW - 30_000,
    open: curve[0],
    high: Math.max(...curve),
    low: Math.min(...curve),
    preClose,
  };
  trends[id] = { id, preClose, points: curve, updatedAt: NOW - 20_000 };
}

const state: StockState = {
  settings: { ...DEFAULT_SETTINGS, stocks },
  quotes,
  trends,
  status: "live",
  source: "tencent",
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
      getTrend: state,
    },
  },
  shots: [
    { slot: "island.page/v1", file: "page.png" },
    { slot: "island.collapsed/v1", file: "bar.png" },
  ],
};
