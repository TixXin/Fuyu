export type CommonText = {
  close: string;
  cancel: string;
  confirm: string;
  retry: string;
  refresh: string;
  clear: string;
  saved: string;
  connecting: string;
  noMessages: string;
  ago: { justNow: string; minutes: (count: number) => string; hours: (count: number) => string; days: (count: number) => string; yesterday: (time: string) => string; date: (month: number, day: number) => string };
  more: string;
  learnMore: string;
  showLess: string;
  chooseFolder: string;
  openFolder: string;
  openFolderMac: string;
  showSecret: string;
  hideSecret: string;
  advanced: string;
  crash: { island: string; window: string; detail: string; reload: string };
};

export const zhCN: CommonText = {
  close: "关闭",
  cancel: "取消",
  confirm: "确认",
  retry: "重试",
  refresh: "刷新",
  clear: "清空",
  saved: "已保存",
  connecting: "连接中",
  noMessages: "暂无消息",
  ago: { justNow: "刚刚", minutes: (count) => `${count} 分钟前`, hours: (count) => `${count} 小时前`, days: (count) => `${count} 天前`, yesterday: (time) => `昨天 ${time}`, date: (month, day) => `${month}月${day}日` },
  more: "更多操作",
  learnMore: "了解更多",
  showLess: "收起",
  chooseFolder: "选择文件夹…",
  openFolder: "打开文件夹",
  openFolderMac: "在访达中打开",
  showSecret: "显示密钥",
  hideSecret: "隐藏密钥",
  advanced: "高级",
  crash: { island: "浮屿出了点问题", window: "这个窗口出了点问题", detail: "错误已记到数据文件夹的 frontend-errors.log。重新加载通常就能恢复。", reload: "重新加载" },
};

export const en: CommonText = {
  close: "Close",
  cancel: "Cancel",
  confirm: "Confirm",
  retry: "Retry",
  refresh: "Refresh",
  clear: "Clear",
  saved: "Saved",
  connecting: "Connecting",
  noMessages: "No messages",
  ago: { justNow: "just now", minutes: (count) => `${count} min ago`, hours: (count) => `${count} h ago`, days: (count) => (count === 1 ? "1 day ago" : `${count} days ago`), yesterday: (time) => `yesterday ${time}`, date: (month, day) => `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][month - 1]} ${day}` },
  more: "More actions",
  learnMore: "Learn more",
  showLess: "Show less",
  chooseFolder: "Choose folder…",
  openFolder: "Open folder",
  openFolderMac: "Open in Finder",
  showSecret: "Show key",
  hideSecret: "Hide key",
  advanced: "Advanced",
  crash: { island: "Fuyu ran into a problem", window: "This window ran into a problem", detail: "The error was saved to frontend-errors.log in the data folder. Reloading usually fixes it.", reload: "Reload" },
};
