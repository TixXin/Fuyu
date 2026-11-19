import { DEFAULT_SETTINGS, type RingSnapshot } from "../src/model.ts";

const NOW = "2026-11-19T10:24:00";

const snapshot: RingSnapshot = {
  date: "2026-11-19",
  done: 3,
  total: 7,
  next: [
    { id: "todo-4", title: "评审新版设置页的设计稿", project: "浮屿" },
    { id: "todo-5", title: "回复客户关于报价单的邮件" },
    { id: "todo-6", title: "下午三点和产品对一下排期", project: "浮屿" },
    { id: "todo-7", title: "把周报发给团队" },
  ],
  error: null,
  settings: { ...DEFAULT_SETTINGS, showCount: 5 },
  at: Date.parse(NOW),
};

export default {
  now: NOW,
  host: {
    calls: {
      snapshot,
    },
  },
  shots: [
    { slot: "island.page/v1", file: "page.png" },
    { slot: "island.collapsed/v1", file: "bar.png" },
  ],
};
