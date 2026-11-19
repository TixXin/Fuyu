import { DEFAULT_SETTINGS, type WorldClockSnapshot } from "../src/model.ts";

const NOW = "2026-11-19T10:24:00+08:00";

const snapshot: WorldClockSnapshot = {
  cities: [
    { id: "city-pek", timeZone: "Asia/Shanghai", labelZh: "北京", labelEn: "Beijing", shortCode: "PEK", pinned: false },
    { id: "city-lon", timeZone: "Europe/London", labelZh: "伦敦", labelEn: "London", shortCode: "LON", pinned: true },
    { id: "city-nyc", timeZone: "America/New_York", labelZh: "纽约", labelEn: "New York", shortCode: "NYC", pinned: false },
    { id: "city-tyo", timeZone: "Asia/Tokyo", labelZh: "东京", labelEn: "Tokyo", shortCode: "TYO", pinned: false },
  ],
  settings: { ...DEFAULT_SETTINGS, timeFormat: "24" },
  at: Date.parse(NOW),
};

export default {
  now: NOW,
  host: {
    calls: {
      "world-clock:get": snapshot,
    },
  },
  shots: [
    { slot: "island.page/v1", file: "page.png" },
    { slot: "island.collapsed/v1", file: "bar.png" },
  ],
};
