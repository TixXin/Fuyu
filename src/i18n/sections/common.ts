export type CommonText = {
  close: string;
  retry: string;
  refresh: string;
  clear: string;
  saved: string;
  connecting: string;
  noMessages: string;
  ago: { justNow: string; minutes: (count: number) => string; hours: (count: number) => string; yesterday: (time: string) => string; date: (month: number, day: number) => string };
  more: string;
  learnMore: string;
  showLess: string;
};

export const zhCN: CommonText = {
  close: "关闭",
  retry: "重试",
  refresh: "刷新",
  clear: "清空",
  saved: "已保存",
  connecting: "连接中",
  noMessages: "暂无消息",
  ago: { justNow: "刚刚", minutes: (count) => `${count} 分钟前`, hours: (count) => `${count} 小时前`, yesterday: (time) => `昨天 ${time}`, date: (month, day) => `${month}月${day}日` },
  more: "更多操作",
  learnMore: "了解更多",
  showLess: "收起",
};

export const en: CommonText = {
  close: "Close",
  retry: "Retry",
  refresh: "Refresh",
  clear: "Clear",
  saved: "Saved",
  connecting: "Connecting",
  noMessages: "No messages",
  ago: { justNow: "just now", minutes: (count) => `${count} min ago`, hours: (count) => `${count} h ago`, yesterday: (time) => `yesterday ${time}`, date: (month, day) => `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][month - 1]} ${day}` },
  more: "More actions",
  learnMore: "Learn more",
  showLess: "Show less",
};
