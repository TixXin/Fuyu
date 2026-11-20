export type ClipboardNoticeText = {
  copied: (summary: string) => string;
  copiedImage: string;
  copiedFiles: (name: string, more: number) => string;
  masked: string;
  notPasted: string;
  openAccessibility: string;
  close: string;
};

export const zhCN: ClipboardNoticeText = {
  copied: (summary) => `已复制 · ${summary}`,
  copiedImage: "已复制图片",
  copiedFiles: (name, more) => (more > 0 ? `已复制 ${name} 等 ${more + 1} 个文件` : `已复制 ${name}`),
  masked: "已复制（已打码）",
  notPasted: "已复制，没能粘贴：要在辅助功能里允许浮屿",
  openAccessibility: "打开辅助功能设置",
  close: "关闭",
};

export const en: ClipboardNoticeText = {
  copied: (summary) => `Copied · ${summary}`,
  copiedImage: "Copied an image",
  copiedFiles: (name, more) => (more > 0 ? `Copied ${name} and ${more} more` : `Copied ${name}`),
  masked: "Copied (masked)",
  notPasted: "Copied, not pasted: allow Fuyu under Accessibility",
  openAccessibility: "Open Accessibility settings",
  close: "Close",
};
