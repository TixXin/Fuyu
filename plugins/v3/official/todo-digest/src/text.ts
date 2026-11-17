const en = {
  title: "Todo digest",
  summary: (open: number, total: number) => `${open} open of ${total} todos today`,
  empty: "No open todos right now",
  more: (count: number) => `+${count} more`,
  write: "Write digest",
  writing: "Writing…",
  writtenAt: (clock: string) => `Last written at ${clock}`,
};

const zhCN: typeof en = {
  title: "待办摘要",
  summary: (open: number, total: number) => `今日共 ${total} 条待办，未完成 ${open} 条`,
  empty: "当前没有未完成待办",
  more: (count: number) => `还有 ${count} 条`,
  write: "写入摘要",
  writing: "写入中…",
  writtenAt: (clock: string) => `上次写入：${clock}`,
};

const isZh = typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh");

export const text = isZh ? zhCN : en;
