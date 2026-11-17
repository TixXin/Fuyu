const en = {
  label: "Today's todos",
  total: (count: number) => `/ ${count} done`,
  left: (count: number) => `${count} left`,
  more: (count: number) => `+${count} more`,
  done: "Done",
  allDone: "All done for today",
  empty: "No todos today",
  refresh: "Refresh",
};

const zhCN: typeof en = {
  label: "今日待办",
  total: (count: number) => `/ ${count} 已完成`,
  left: (count: number) => `还剩 ${count} 条`,
  more: (count: number) => `还有 ${count} 条`,
  done: "已完成",
  allDone: "今天的待办都做完了",
  empty: "今天还没有待办",
  refresh: "刷新",
};

const isZh = typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh");

export const text = isZh ? zhCN : en;
