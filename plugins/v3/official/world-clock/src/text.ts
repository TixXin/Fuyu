const en = {
  title: "World Clock",
  isZh: false,
  empty: "No cities added yet.",
  add: "Add",
  pin: "Pin",
  pinned: "Bar",
  remove: "Remove",
  customPlaceholder: "Or IANA zone (e.g. Europe/Berlin)",
  sameZone: "Local time",
  ahead: (h: number) => `+${h}h`,
  behind: (h: number) => `${h}h`,
  today: "Today",
  tomorrow: "Tomorrow",
  yesterday: "Yesterday",
  day: "Day",
  night: "Night",
  showInBar: "Show pinned city on collapsed bar",
  summary: (count: number) => `${count} city clock(s)`,
  invalidZone: "Invalid IANA time zone.",
};

const zhCN: typeof en = {
  title: "世界时钟",
  isZh: true,
  empty: "还没有添加城市。",
  add: "添加",
  pin: "上岛",
  pinned: "已上岛",
  remove: "移除",
  customPlaceholder: "或输入时区（如 Europe/Berlin）",
  sameZone: "与本机相同",
  ahead: (h: number) => `快 ${h} 小时`,
  behind: (h: number) => `慢 ${Math.abs(h)} 小时`,
  today: "今天",
  tomorrow: "明天",
  yesterday: "昨天",
  day: "白天",
  night: "夜晚",
  showInBar: "在收起条显示关注城市时间",
  summary: (count: number) => `已添加 ${count} 个城市`,
  invalidZone: "无效的 IANA 时区名称。",
};

const isZh = typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh");

export const text = isZh ? zhCN : en;
