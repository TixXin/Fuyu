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
  zoom: {
    bar: string;
    zoomIn: string;
    zoomOut: string;
    fit: string;
    actual: string;
    actualHint: string;
    level: (percent: number) => string;
  };
  image: {
    edit: string;
    toolbar: string;
    crop: string;
    applyCrop: string;
    cropHint: string;
    rotateLeft: string;
    rotateRight: string;
    saving: string;
    failed: string;
    unreadable: string;
  };
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
  zoom: {
    bar: "图片缩放",
    zoomIn: "放大",
    zoomOut: "缩小",
    fit: "适应",
    actual: "1:1",
    actualHint: "原始大小",
    level: (percent) => `${percent}%`,
  },
  image: {
    edit: "编辑图片",
    toolbar: "图片编辑工具",
    crop: "裁剪",
    applyCrop: "应用裁剪",
    cropHint: "拖出要留下的部分，回车应用",
    rotateLeft: "向左转",
    rotateRight: "向右转",
    saving: "正在保存…",
    failed: "没保存上，再试一次或另存一条",
    unreadable: "这张图片读不出来，没法编辑",
  },
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
  zoom: {
    bar: "Image zoom",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    fit: "Fit",
    actual: "1:1",
    actualHint: "Actual size",
    level: (percent) => `${percent}%`,
  },
  image: {
    edit: "Edit image",
    toolbar: "Image editing tools",
    crop: "Crop",
    applyCrop: "Apply crop",
    cropHint: "Drag over the part to keep, then press Enter",
    rotateLeft: "Rotate left",
    rotateRight: "Rotate right",
    saving: "Saving…",
    failed: "Couldn't save. Try again or save as a new entry.",
    unreadable: "This image can't be read, so it can't be edited.",
  },
};
