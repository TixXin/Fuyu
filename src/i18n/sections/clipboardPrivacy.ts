export type ClipboardPrivacyText = {
  forgetCleared: string;
  forgetClearedHint: string;
  secretExpiry: string;
  secretExpiryHint: string;
  secretExpiryOption: (minutes: number) => string;
  maxText: string;
  maxTextHint: string;
  maxTextOption: (kb: number) => string;
  truncated: string;
};

const zhDuration = (minutes: number) => {
  if (minutes === 0) return "不删";
  if (minutes < 60) return `${minutes} 分钟后`;
  if (minutes < 24 * 60) return `${minutes / 60} 小时后`;
  return `${minutes / (24 * 60)} 天后`;
};

const enDuration = (minutes: number) => {
  if (minutes === 0) return "Never";
  if (minutes < 60) return `After ${minutes} min`;
  if (minutes < 24 * 60) return minutes === 60 ? "After 1 hour" : `After ${minutes / 60} hours`;
  const days = minutes / (24 * 60);
  return days === 1 ? "After 1 day" : `After ${days} days`;
};

const size = (kb: number) => (kb >= 1024 ? `${kb / 1024} MB` : `${kb} KB`);

export const zhCN: ClipboardPrivacyText = {
  forgetCleared: "剪贴板被清空时删掉刚记下的那条",
  forgetClearedHint: "密码管理器复制密码后过一会儿会清空剪贴板；刚记下 2 分钟内的那条（不含收藏）跟着从历史里删掉。",
  secretExpiry: "打码的条目自动删除",
  secretExpiryHint: "按最后一次复制的时间算，收藏的不删。",
  secretExpiryOption: zhDuration,
  maxText: "单条文字大小上限",
  maxTextHint: "超过的只记前面一段并标「已截断」，贴回去的不是完整原文；格式（HTML）超过上限时不记。",
  maxTextOption: (kb) => (kb === 0 ? "不限" : size(kb)),
  truncated: "已截断",
};

export const en: ClipboardPrivacyText = {
  forgetCleared: "Forget the last entry when the clipboard is cleared",
  forgetClearedHint: "Password managers clear the clipboard a while after copying a password; the entry recorded in the last 2 minutes (unless starred) is removed from history too.",
  secretExpiry: "Delete masked entries",
  secretExpiryHint: "Counted from the last copy; starred entries are kept.",
  secretExpiryOption: enDuration,
  maxText: "Size limit per text entry",
  maxTextHint: "Longer text keeps only its beginning and is marked “Truncated”, so pasting it back is not the full original; formatting (HTML) over the limit is dropped.",
  maxTextOption: (kb) => (kb === 0 ? "No limit" : size(kb)),
  truncated: "Truncated",
};
