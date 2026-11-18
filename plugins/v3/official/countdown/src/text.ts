const en = {
  title: "Countdown",
  empty: "No dates yet. Add an upcoming milestone or anniversary below.",
  titlePlaceholder: "Event name",
  add: "Add",
  pin: "Pin",
  pinned: "Pinned",
  setBg: "Background",
  clearBg: "Clear bg",
  remove: "Delete",
  today: "Today",
  daysLeft: (days: number) => (days === 1 ? "1 day left" : `${days} days left`),
  daysPast: (days: number) => (days === 1 ? "1 day ago" : `${days} days ago`),
  barChip: (days: number) => (days === 0 ? "Today" : days > 0 ? `${days}d` : `+${Math.abs(days)}d`),
  showInBar: "Show remaining days on collapsed bar",
  showInBarHint: "Displays the pinned or nearest upcoming event on the collapsed island.",
  countSummary: (count: number) => `${count} saved date(s)`,
  bgTooLarge: "Image is too large (keep under 500 KB).",
};

const zhCN: typeof en = {
  title: "倒数日",
  empty: "还没有日期，在下方添加一个重要日子或纪念日吧。",
  titlePlaceholder: "事件名称",
  add: "添加",
  pin: "置顶",
  pinned: "已置顶",
  setBg: "设背景图",
  clearBg: "去背景",
  remove: "删除",
  today: "就是今天",
  daysLeft: (days: number) => `还有 ${days} 天`,
  daysPast: (days: number) => `已过 ${days} 天`,
  barChip: (days: number) => (days === 0 ? "今天" : days > 0 ? `${days}天` : `+${Math.abs(days)}天`),
  showInBar: "在收起条显示天数",
  showInBarHint: "在收起的小岛上显示置顶或最近一个倒数日的剩余天数。",
  countSummary: (count: number) => `已保存 ${count} 个日期`,
  bgTooLarge: "背景图片过大，请选择 500 KB 以内的图片。",
};

const isZh = typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh");

export const text = isZh ? zhCN : en;
