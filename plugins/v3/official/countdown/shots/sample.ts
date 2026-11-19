import { DEFAULT_SETTINGS, type CountdownItem, type CountdownKind, type CountdownSnapshot } from "../src/model.ts";

const NOW = Date.parse("2026-11-19T10:24:00");

const item = (id: string, title: string, date: string, kind: CountdownKind = "countdown", repeat = false): CountdownItem => ({
  id,
  title,
  date,
  pinned: false,
  kind,
  repeat,
  bgRev: null,
});

const state: CountdownSnapshot = {
  items: [
    { ...item("home", "春节回家", "2027-02-05"), pinned: true },
    item("proposal", "项目提案截止", "2026-11-27"),
    item("mom", "妈妈生日", "1968-12-03", "countdown", true),
    item("review", "年终述职", "2026-12-18"),
    item("passport", "护照到期", "2027-03-15"),
    item("together", "在一起", "2021-05-20", "anniversary"),
    item("house", "搬进新家", "2025-08-16", "anniversary"),
  ],
  settings: { ...DEFAULT_SETTINGS, barStyle: "title" },
  at: NOW,
};

export default {
  now: NOW,
  host: {
    calls: {
      "countdown:get": state,
      "countdown:background": { dataUrl: null },
    },
  },
  shots: [
    { slot: "island.page/v1", file: "page.png" },
    { slot: "island.collapsed/v1", file: "bar.png" },
  ],
};
