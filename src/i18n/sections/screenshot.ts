/** The screenshot overlay (the toolbar beside the selection, the magnifier by the pointer) and pins. */
export type ScreenshotText = {
  toolbar: string;
  copy: string;
  save: string;
  pin: string;
  /** The folder under Pictures that saves go to until one is chosen in the settings. */
  saveFolderName: string;
  saved: (path: string) => string;
  cancel: string;
  /** Under the magnifier: the key that copies the colour under the pointer. */
  copyColorHint: string;
  colorCopied: (hex: string) => string;
  /** Shown before anything is selected. */
  selectHint: string;
  /** The same for the shortcuts that act as soon as a region is chosen (quickAction in api.ts). */
  quickHints: Record<"copy" | "text" | "translate", string>;
  readText: string;
  /** On the island: the text read in a screenshot, now on the clipboard. */
  textCopied: (line: string) => string;
  noText: string;
  /** The annotation tools (AnnotationTool in src/features/screenshot/annotations.ts). */
  tools: Record<"rect" | "ellipse" | "arrow" | "pen" | "highlighter" | "text" | "mosaic" | "number", string>;
  undo: string;
  redo: string;
  /** Line thickness, thin to thick (StrokeLevel). */
  sizes: Record<0 | 1 | 2, string>;
  color: (hex: string) => string;
  textPlaceholder: string;
  /** A pin's right-click menu. */
  pinMenu: {
    copy: string;
    save: string;
    actualSize: string;
    clickThrough: string;
    hideAll: string;
    close: string;
    closeAll: string;
  };
  pinCopied: string;
  /** The island's screenshot card (ScreenshotCard.tsx). */
  card: {
    copied: string;
    saved: string;
    dragHint: string;
    shelf: string;
    shelved: string;
    sendToAgent: string;
    noAgent: string;
    agentNotFound: string;
    close: string;
  };
};

export const zhCN: ScreenshotText = {
  toolbar: "截图工具栏",
  copy: "复制（Enter）",
  save: "保存（Ctrl+S）",
  pin: "贴到屏幕上（T）",
  saveFolderName: "浮屿截图",
  saved: (path) => `已保存到 ${path}`,
  cancel: "取消（Esc）",
  copyColorHint: "按 C 复制颜色",
  colorCopied: (hex) => `已复制 ${hex}`,
  selectHint: "单击选中窗口或控件，拖动选择区域 · 滚轮切换层级 · 右键或 Esc 退出",
  quickHints: {
    copy: "单击选中窗口或控件，或拖动选择区域，选好就复制 · 右键或 Esc 退出",
    text: "单击选中窗口或控件，或拖动选择区域，选好就识别文字并复制 · 右键或 Esc 退出",
    translate: "单击选中窗口或控件，或拖动选择区域，选好就识别文字并翻译 · 右键或 Esc 退出",
  },
  readText: "识别文字",
  textCopied: (line) => `已复制识别的文字：${line}`,
  noText: "截图里没有识别到文字",
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
  pinMenu: {
    copy: "复制",
    save: "保存",
    actualSize: "原始大小",
    clickThrough: "鼠标穿透（隐藏再显示贴图后恢复）",
    hideAll: "隐藏所有贴图（T）",
    close: "关闭（Esc）",
    closeAll: "关闭所有贴图",
  },
  pinCopied: "已复制",
  card: {
    copied: "截图已复制",
    saved: "截图已保存",
    dragHint: "拖到别处，作为文件放下",
    shelf: "放进文件中转",
    shelved: "已放进文件中转",
    sendToAgent: "发给 Agent",
    noAgent: "没有正在运行的 Agent 会话",
    agentNotFound: "找不到这个会话的窗口",
    close: "关闭",
  },
};

export const en: ScreenshotText = {
  toolbar: "Screenshot toolbar",
  copy: "Copy (Enter)",
  save: "Save (Ctrl+S)",
  pin: "Pin to screen (T)",
  saveFolderName: "Fuyu Screenshots",
  saved: (path) => `Saved to ${path}`,
  cancel: "Cancel (Esc)",
  copyColorHint: "Press C to copy the colour",
  colorCopied: (hex) => `Copied ${hex}`,
  selectHint: "Click a window or control, or drag a region · Scroll to step out or in · Right-click or Esc to exit",
  quickHints: {
    copy: "Click a window or control, or drag a region, and it is copied · Right-click or Esc to exit",
    text: "Click a window or control, or drag a region, and its text is read and copied · Right-click or Esc to exit",
    translate: "Click a window or control, or drag a region, and its text is read and translated · Right-click or Esc to exit",
  },
  readText: "Read text",
  textCopied: (line) => `Copied the text: ${line}`,
  noText: "No text found in the screenshot",
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
  pinMenu: {
    copy: "Copy",
    save: "Save",
    actualSize: "Actual size",
    clickThrough: "Click through (until pins are hidden and shown)",
    hideAll: "Hide all pins (T)",
    close: "Close (Esc)",
    closeAll: "Close all pins",
  },
  pinCopied: "Copied",
  card: {
    copied: "Screenshot copied",
    saved: "Screenshot saved",
    dragHint: "Drag it somewhere to drop it as a file",
    shelf: "Put on the file shelf",
    shelved: "On the file shelf",
    sendToAgent: "Send to an agent",
    noAgent: "No agent session is running",
    agentNotFound: "Could not find this session's window",
    close: "Close",
  },
};
