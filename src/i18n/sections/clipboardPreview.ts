export type ClipboardPreviewText = {
  toolbar: string;
  pin: string;
  unpin: string;
  sizes: string;
  size: Record<"standard" | "medium" | "full", string>;
  sizeKey: string;
  close: string;
  releaseToKeep: string;
  pinnedHint: string;
  toggleFull: string;
};

export const zhCN: ClipboardPreviewText = {
  toolbar: "预览工具栏",
  pin: "钉住预览：空格不再关闭",
  unpin: "取消钉住",
  sizes: "预览大小",
  size: { standard: "标准", medium: "中等", full: "全屏" },
  sizeKey: "按 F 切换",
  close: "关闭预览",
  releaseToKeep: "松开后保留",
  pinnedHint: "已钉住",
  toggleFull: "双击切换全屏",
};

export const en: ClipboardPreviewText = {
  toolbar: "Preview toolbar",
  pin: "Pin the preview so Space keeps it open",
  unpin: "Unpin",
  sizes: "Preview size",
  size: { standard: "Standard", medium: "Medium", full: "Full" },
  sizeKey: "Press F to switch",
  close: "Close preview",
  releaseToKeep: "Release to keep",
  pinnedHint: "Pinned",
  toggleFull: "Double-click to toggle full screen",
};
