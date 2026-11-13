export type ScreenshotText = {
  toolbar: string;
  copy: string;
  save: string;
  pin: string;
  saveFolderName: string;
  saved: (path: string) => string;
  cancel: string;
  copyColorHint: string;
  colorCopied: (hex: string) => string;
  selectHint: string;
  quickHints: Record<"copy" | "text" | "translate" | "long", string>;
  longShot: string;
  long: {
    title: string;
    height: (px: number) => string;
    frames: (count: number) => string;
    size: (width: number, height: number) => string;
    states: Record<"ready" | "scrolling" | "paused" | "end" | "fast" | "full", string>;
    start: string;
    pause: string;
    resume: string;
    cancel: string;
    save: string;
    done: string;
    keys: string;
  };
  readText: string;
  textCopied: (line: string) => string;
  noText: string;
  redact: string;
  redacting: string;
  redacted: (count: number) => string;
  nothingToRedact: string;
  tools: Record<"rect" | "ellipse" | "arrow" | "pen" | "highlighter" | "text" | "mosaic" | "number", string>;
  undo: string;
  redo: string;
  sizes: Record<0 | 1 | 2, string>;
  color: (hex: string) => string;
  textPlaceholder: string;
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
  history: {
    title: string;
    empty: string;
    emptyHint: string;
    copyHint: string;
    copyLabel: (when: string) => string;
    copied: string;
    pin: string;
    remove: string;
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
    long: "选好要滚动的区域，浮屿往下滚并拼成长图，旁边的控制条可以暂停、完成或取消 · 右键或 Esc 退出",
  },
  readText: "识别文字",
  textCopied: (line) => `已复制识别的文字：${line}`,
  noText: "截图里没有识别到文字",
  longShot: "长截图（自动往下滚动拼接，也可以自己滚）",
  long: {
    title: "长截图",
    height: (px) => `高 ${px.toLocaleString()} px`,
    frames: (count) => `${count} 屏`,
    size: (width, height) => `${width} × ${height.toLocaleString()}`,
    states: {
      ready: "按空格或 ▶ 开始自动滚动，也可以自己在框里滚",
      scrolling: "正在往下滚动拼接……",
      paused: "已暂停。可以自己在框里滚动，浮屿照样拼上",
      end: "到底了，点 ✓ 复制",
      fast: "这一下滚太多，接不上了。往回滚一点就好",
      full: "已到 2 万像素上限",
    },
    start: "开始自动滚动（空格）",
    pause: "暂停自动滚动（空格）",
    resume: "继续自动滚动（空格）",
    cancel: "取消（Esc）",
    save: "保存（Ctrl+S）",
    done: "完成并复制（Enter）",
    keys: "空格 开始 / 暂停 · Enter 完成 · Esc 取消",
  },
  redact: "自动打码（邮箱、手机号、IP、密钥）",
  redacting: "正在找要打码的内容…",
  redacted: (count) => `打了 ${count} 处码；点一处可以取消`,
  nothingToRedact: "没找到邮箱、手机号、IP 或密钥",
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
  history: {
    title: "截图历史",
    empty: "还没有截图",
    emptyHint: "复制、保存或贴到屏幕上的截图会留在这里。",
    copyHint: "点一下复制，拖出去当文件用",
    copyLabel: (when) => `复制 ${when} 的截图`,
    copied: "已复制",
    pin: "贴到屏幕上",
    remove: "删除",
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
    long: "Choose the area that scrolls; Fuyu scrolls and stitches one tall picture, with a control bar to pause, finish or cancel · Right-click or Esc to exit",
  },
  readText: "Read text",
  textCopied: (line) => `Copied the text: ${line}`,
  noText: "No text found in the screenshot",
  longShot: "Long screenshot (scrolls and stitches; you can scroll yourself too)",
  long: {
    title: "Long screenshot",
    height: (px) => `${px.toLocaleString()} px tall`,
    frames: (count) => (count === 1 ? "1 screen" : `${count} screens`),
    size: (width, height) => `${width} × ${height.toLocaleString()}`,
    states: {
      ready: "Press Space or ▶ to start scrolling, or scroll inside the frame yourself",
      scrolling: "Scrolling down and stitching…",
      paused: "Paused. Scroll inside the frame yourself and it keeps stitching",
      end: "Reached the end. Click ✓ to copy",
      fast: "That scroll went too far to join up. Scroll back a little",
      full: "Reached the 20,000 px limit",
    },
    start: "Start auto-scroll (Space)",
    pause: "Pause auto-scroll (Space)",
    resume: "Resume auto-scroll (Space)",
    cancel: "Cancel (Esc)",
    save: "Save (Ctrl+S)",
    done: "Done, copy it (Enter)",
    keys: "Space start / pause · Enter done · Esc cancel",
  },
  redact: "Auto-redact emails, phone numbers, IPs and keys",
  redacting: "Looking for things to redact…",
  redacted: (count) => (count === 1 ? "Redacted 1 spot; click it to undo" : `Redacted ${count} spots; click one to undo it`),
  nothingToRedact: "No emails, phone numbers, IPs or keys found",
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
  history: {
    title: "Screenshot history",
    empty: "No screenshots yet",
    emptyHint: "Screenshots you copy, save or pin to the screen stay here.",
    copyHint: "Click to copy, drag out as a file",
    copyLabel: (when) => `Copy the screenshot from ${when}`,
    copied: "Copied",
    pin: "Pin to screen",
    remove: "Delete",
  },
};
