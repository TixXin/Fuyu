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
  /** The annotation tools (AnnotationTool in src/features/screenshot/annotations.ts). */
  tools: Record<"rect" | "ellipse" | "arrow" | "pen" | "highlighter" | "text" | "mosaic" | "number", string>;
  undo: string;
  redo: string;
  /** Line thickness, thin to thick (StrokeLevel). */
  sizes: Record<0 | 1 | 2, string>;
  color: (hex: string) => string;
  textPlaceholder: string;
};

export const zhCN: ScreenshotText = {
  toolbar: "截图工具栏",
  copy: "复制（Enter）",
  cancel: "取消（Esc）",
  copyColorHint: "按 C 复制颜色",
  colorCopied: (hex) => `已复制 ${hex}`,
  selectHint: "单击选中窗口或控件，拖动选择区域 · 滚轮切换层级 · 右键或 Esc 退出",
  tools: {
    rect: "矩形",
    ellipse: "椭圆",
    arrow: "箭头",
    pen: "画笔",
    highlighter: "荧光笔",
    text: "文字",
    mosaic: "马赛克",
    number: "序号",
  },
  undo: "撤销（Ctrl+Z）",
  redo: "重做（Ctrl+Y）",
  sizes: { 0: "细", 1: "中", 2: "粗" },
  color: (hex) => `颜色 ${hex}`,
  textPlaceholder: "输入文字",
};

export const en: ScreenshotText = {
  toolbar: "Screenshot toolbar",
  copy: "Copy (Enter)",
  cancel: "Cancel (Esc)",
  copyColorHint: "Press C to copy the colour",
  colorCopied: (hex) => `Copied ${hex}`,
  selectHint: "Click a window or control, or drag a region · Scroll to step out or in · Right-click or Esc to exit",
  tools: {
    rect: "Rectangle",
    ellipse: "Ellipse",
    arrow: "Arrow",
    pen: "Pen",
    highlighter: "Highlighter",
    text: "Text",
    mosaic: "Mosaic",
    number: "Number",
  },
  undo: "Undo (Ctrl+Z)",
  redo: "Redo (Ctrl+Y)",
  sizes: { 0: "Thin", 1: "Medium", 2: "Thick" },
  color: (hex) => `Colour ${hex}`,
  textPlaceholder: "Type text",
};
