/** The screenshot overlay: the toolbar beside the selection and the magnifier by the pointer. */
export type ScreenshotText = {
  toolbar: string;
  copy: string;
  cancel: string;
  /** Under the magnifier: the key that copies the colour under the pointer. */
  copyColorHint: string;
  colorCopied: (hex: string) => string;
  /** Shown before anything is selected. */
  selectHint: string;
};

export const zhCN: ScreenshotText = {
  toolbar: "截图工具栏",
  copy: "复制（Enter）",
  cancel: "取消（Esc）",
  copyColorHint: "按 C 复制颜色",
  colorCopied: (hex) => `已复制 ${hex}`,
  selectHint: "单击选中窗口或控件，拖动选择区域 · 滚轮切换层级 · 右键或 Esc 退出",
};

export const en: ScreenshotText = {
  toolbar: "Screenshot toolbar",
  copy: "Copy (Enter)",
  cancel: "Cancel (Esc)",
  copyColorHint: "Press C to copy the colour",
  colorCopied: (hex) => `Copied ${hex}`,
  selectHint: "Click a window or control, or drag a region · Scroll to step out or in · Right-click or Esc to exit",
};
