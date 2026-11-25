export type ScreenshotText = {
  toolbar: string;
  copy: string;
  save: string;
  saveMac: string;
  pin: string;
  saveFolderName: string;
  recordFolderName: string;
  recordGifHint: string;
  saved: (path: string) => string;
  cancel: string;
  copyColorHint: string;
  measureHint: string;
  ruler: (length: number, dx: number, dy: number) => string;
  colorCopied: (hex: string) => string;
  selectHint: string;
  quickHints: Record<"copy" | "text" | "translate" | "long" | "record", string>;
  longShot: string;
  recordArea: string;
  windowShadow: string;
  showKeys: string;
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
    saveMac: string;
    done: string;
    keys: string;
  };
  readText: string;
  textCopied: (line: string) => string;
  noText: string;
  translateOff: string;
  shelfOff: string;
  redact: string;
  redacting: string;
  redacted: (count: number) => string;
  nothingToRedact: string;
  tools: Record<"rect" | "ellipse" | "line" | "arrow" | "pen" | "highlighter" | "text" | "mosaic" | "blur" | "spotlight" | "number", string>;
  toolWithKey: (name: string, key: string) => string;
  undo: string;
  undoMac: string;
  redo: string;
  redoMac: string;
  sizes: Record<0 | 1 | 2, string>;
  color: (hex: string) => string;
  textPlaceholder: string;
  deleteAnnotation: string;
  sheet: {
    title: string;
    collapse: string;
    expand: string;
    dragHint: string;
    sections: Record<"pick" | "finish" | "tools" | "record", string>;
    words: Record<"drag" | "click" | "wheel" | "hold", string>;
    rows: Record<
      | "selectArea" | "pickWindow" | "layer" | "copyColor" | "measure" | "cancel" | "copy" | "save" | "pin" | "undoRedo" | "deleteMark" | "wholeScreen" | "gif" | "collapse"
      | "rect" | "ellipse" | "line" | "arrow" | "pen" | "highlighter" | "text" | "mosaic" | "blur" | "spotlight" | "number",
      string
    >;
  };
  qr: { title: string; button: (count: number) => string; link: string; text: string; open: string; copy: string; copied: string };
  pinMenu: {
    copy: string;
    save: string;
    actualSize: string;
    clickThrough: string;
    hideAll: string;
    close: string;
    closeAll: string;
    annotate: string;
    readText: string;
    turnLeft: string;
    turnRight: string;
    flipX: string;
    flipY: string;
    collapse: string;
    expand: string;
  };
  pinAnnotate: { done: string; cancel: string };
  pinText: { reading: string; copied: string; empty: string };
  pinCopied: string;
  recording: {
    countdown: (seconds: number) => string;
    running: (time: string) => string;
    paused: (time: string) => string;
    pause: string;
    resume: string;
    stop: string;
    cancel: string;
    saved: (time: string) => string;
    reveal: string;
    shelve: string;
    shelved: string;
    close: string;
  };
  delay: {
    countdown: (seconds: number) => string;
    cancel: string;
    menu: string;
    option: (seconds: number) => string;
    buttonHint: string;
  };
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
    instruction: string;
    instructionHint: string;
    sendNow: string;
    source: string;
  };
  history: {
    title: string;
    empty: string;
    emptyHint: string;
    copyHint: string;
    copyLabel: (when: string) => string;
    copied: string;
    copy: string;
    pin: string;
    remove: string;
    today: string;
    yesterday: string;
    date: (year: number | null, month: number, day: number) => string;
    dayCount: (count: number) => string;
    tab: string;
    search: string;
    clearSearch: string;
    noMatch: (query: string) => string;
  };
};

export const zhCN: ScreenshotText = {
  toolbar: "截图工具栏",
  copy: "复制（Enter）",
  save: "保存（Ctrl+S）",
  saveMac: "保存（⌘S）",
  pin: "贴到屏幕上（T）",
  saveFolderName: "浮屿截图",
  recordFolderName: "浮屿录屏",
  recordGifHint: "录成 GIF（不带声音）：拖动选择区域，或单击选中窗口，按 F 录整个屏幕；按 G 改回 MP4 · 右键或 Esc 退出",
  saved: (path) => `已保存到 ${path}`,
  cancel: "取消（Esc）",
  copyColorHint: "按 C 复制颜色",
  measureHint: "按住 M 测量距离",
  ruler: (length, dx, dy) => `${length} px（横 ${dx}，竖 ${dy}）`,
  colorCopied: (hex) => `已复制 ${hex}`,
  selectHint: "单击选中窗口或控件，拖动选择区域 · 滚轮切换层级 · 右键或 Esc 退出",
  quickHints: {
    copy: "单击选中窗口或控件，或拖动选择区域，选好就复制 · 右键或 Esc 退出",
    text: "单击选中窗口或控件，或拖动选择区域，选好就识别文字并复制 · 右键或 Esc 退出",
    translate: "单击选中窗口或控件，或拖动选择区域，选好就识别文字并翻译 · 右键或 Esc 退出",
    long: "选好要滚动的区域，浮屿往下滚并拼成长图，旁边的控制条可以暂停、完成或取消 · 右键或 Esc 退出",
    record: "拖动选择要录的区域，或单击选中窗口，按 F 录整个屏幕，按 G 改录 GIF；3 秒后开始，再按 Ctrl+Shift+6 停止 · 右键或 Esc 退出",
  },
  readText: "识别文字",
  textCopied: (line) => `已复制识别的文字：${line}`,
  noText: "截图里没有识别到文字",
  translateOff: "快捷翻译已关闭，打开后才能翻译截图",
  shelfOff: "文件中转已关闭",
  longShot: "长截图（自动往下滚动拼接，也可以自己滚）",
  recordArea: "录屏（3 秒后开始录这个区域，标注不会录进去）",
  windowShadow: "导出透明背景与窗口阴影（PNG）",
  showKeys: "快捷键（?）",
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
    saveMac: "保存（⌘S）",
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
    line: "直线（按住 Shift 吸附角度）",
    arrow: "箭头",
    pen: "画笔",
    highlighter: "荧光笔",
    text: "文字",
    mosaic: "马赛克",
    blur: "模糊",
    spotlight: "聚光灯（框外压暗）",
    number: "序号",
  },
  toolWithKey: (name, key) => `${name}（${key}）`,
  undo: "撤销（Ctrl+Z）",
  undoMac: "撤销（⌘Z）",
  redo: "重做（Ctrl+Y）",
  redoMac: "重做（⇧⌘Z）",
  sizes: { 0: "细", 1: "中", 2: "粗" },
  color: (hex) => `颜色 ${hex}`,
  textPlaceholder: "输入文字",
  deleteAnnotation: "删除这个标注（Delete）",
  sheet: {
    title: "快捷键",
    collapse: "收起（?）",
    expand: "展开快捷键说明（?）",
    dragHint: "拖动标题栏换到别的角",
    sections: { pick: "选区", finish: "截完", tools: "标注工具", record: "录屏" },
    words: { drag: "拖动", click: "单击", wheel: "滚轮", hold: "按住" },
    rows: {
      selectArea: "选区域", pickWindow: "选窗口 / 控件", layer: "换外层 / 内层", copyColor: "复制颜色", measure: "测量距离", cancel: "取消",
      copy: "复制", save: "保存", pin: "贴到屏幕", undoRedo: "撤销 / 重做", deleteMark: "删除选中标注", wholeScreen: "整个屏幕", gif: "MP4 / GIF", collapse: "收起说明",
      rect: "矩形", ellipse: "椭圆", line: "直线", arrow: "箭头", pen: "画笔", highlighter: "荧光笔", text: "文字", mosaic: "马赛克", blur: "模糊", spotlight: "聚光灯", number: "序号",
    },
  },
  qr: {
    title: "选区里的二维码",
    button: (count) => (count > 1 ? `识别到 ${count} 个二维码` : "识别到二维码"),
    link: "网址",
    text: "文本",
    open: "打开链接",
    copy: "复制",
    copied: "已复制二维码内容",
  },
  pinMenu: {
    copy: "复制",
    save: "保存",
    actualSize: "原始大小",
    clickThrough: "鼠标穿透（隐藏再显示贴图后恢复）",
    hideAll: "隐藏所有贴图（T）",
    close: "关闭（Esc）",
    closeAll: "关闭所有贴图",
    annotate: "标注（空格）",
    readText: "识别文字并复制（O）",
    turnLeft: "向左转 90°（1）",
    turnRight: "向右转 90°（2）",
    flipX: "水平翻转（3）",
    flipY: "垂直翻转（4）",
    collapse: "缩成小图标（双击 / M）",
    expand: "还原（双击 / M）",
  },
  pinAnnotate: { done: "完成标注（Enter）", cancel: "放弃这次标注（Esc）" },
  pinText: { reading: "正在识别文字…", copied: "已复制识别出的文字", empty: "没有识别到文字" },
  pinCopied: "已复制",
  recording: {
    countdown: (seconds) => `${seconds} 秒后开始录屏`,
    running: (time) => `录屏中 ${time}`,
    paused: (time) => `已暂停 ${time}`,
    pause: "暂停",
    resume: "继续",
    stop: "停止并保存（Ctrl+Shift+6）",
    cancel: "取消",
    saved: (time) => `录屏已保存 · ${time}`,
    reveal: "在文件夹中显示",
    shelve: "放进文件中转",
    shelved: "已放进文件中转",
    close: "关闭",
  },
  delay: {
    countdown: (seconds) => `${seconds} 秒后截图`,
    cancel: "取消延时截图",
    menu: "延时截图",
    option: (seconds) => `${seconds} 秒后截图`,
    buttonHint: "截图（右键可选延时）",
  },
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
    instruction: "给 Agent 的一句话",
    instructionHint: "写一句话，回车发送（可不写）",
    sendNow: "发送",
    source: "来源：",
  },
  history: {
    title: "截图历史",
    empty: "还没有截图",
    emptyHint: "复制、保存或贴到屏幕上的截图会留在这里。",
    copyHint: "点一下复制，拖出去当文件用",
    copyLabel: (when) => `复制 ${when} 的截图`,
    copied: "已复制",
    copy: "复制",
    pin: "贴到屏幕上",
    remove: "删除",
    today: "今天",
    yesterday: "昨天",
    date: (year, month, day) => `${year ? `${year}年` : ""}${month}月${day}日`,
    dayCount: (count) => `${count} 张`,
    tab: "截图",
    search: "搜图里的文字",
    clearSearch: "清除搜索",
    noMatch: (query) => `没有截图里有「${query}」`,
  },
};

export const en: ScreenshotText = {
  toolbar: "Screenshot toolbar",
  copy: "Copy (Enter)",
  save: "Save (Ctrl+S)",
  saveMac: "Save (⌘S)",
  pin: "Pin to screen (T)",
  saveFolderName: "Fuyu Screenshots",
  recordFolderName: "Fuyu Recordings",
  recordGifHint: "Recording a GIF (no sound): drag an area, click a window, or press F for the whole screen; G switches back to MP4 · Right-click or Esc to exit",
  saved: (path) => `Saved to ${path}`,
  cancel: "Cancel (Esc)",
  copyColorHint: "Press C to copy the colour",
  measureHint: "Hold M to measure",
  ruler: (length, dx, dy) => `${length} px (${dx} across, ${dy} down)`,
  colorCopied: (hex) => `Copied ${hex}`,
  selectHint: "Click a window or control, or drag a region · Scroll to step out or in · Right-click or Esc to exit",
  quickHints: {
    copy: "Click a window or control, or drag a region, and it is copied · Right-click or Esc to exit",
    text: "Click a window or control, or drag a region, and its text is read and copied · Right-click or Esc to exit",
    translate: "Click a window or control, or drag a region, and its text is read and translated · Right-click or Esc to exit",
    long: "Choose the area that scrolls; Fuyu scrolls and stitches one tall picture, with a control bar to pause, finish or cancel · Right-click or Esc to exit",
    record: "Drag the area to record, click a window, or press F for the whole screen; G records a GIF instead. Recording starts after 3 seconds, Ctrl+Shift+6 again stops it · Right-click or Esc to exit",
  },
  readText: "Read text",
  textCopied: (line) => `Copied the text: ${line}`,
  noText: "No text found in the screenshot",
  translateOff: "Quick translation is off. Turn it on to translate screenshots.",
  shelfOff: "The file shelf is off",
  longShot: "Long screenshot (scrolls and stitches; you can scroll yourself too)",
  recordArea: "Record this area (starts in 3 seconds; marks are not recorded)",
  windowShadow: "Export with transparent background & window shadow (PNG)",
  showKeys: "Shortcuts (?)",
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
    saveMac: "Save (⌘S)",
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
    line: "Line (hold Shift to snap the angle)",
    arrow: "Arrow",
    pen: "Pen",
    highlighter: "Highlighter",
    text: "Text",
    mosaic: "Mosaic",
    blur: "Blur",
    spotlight: "Spotlight (dims the rest)",
    number: "Number",
  },
  toolWithKey: (name, key) => `${name} (${key})`,
  undo: "Undo (Ctrl+Z)",
  undoMac: "Undo (⌘Z)",
  redo: "Redo (Ctrl+Y)",
  redoMac: "Redo (⇧⌘Z)",
  sizes: { 0: "Thin", 1: "Medium", 2: "Thick" },
  color: (hex) => `Colour ${hex}`,
  textPlaceholder: "Type text",
  deleteAnnotation: "Delete this annotation (Delete)",
  sheet: {
    title: "Shortcuts",
    collapse: "Collapse (?)",
    expand: "Show shortcuts (?)",
    dragHint: "Drag the title to another corner",
    sections: { pick: "Select", finish: "Finish", tools: "Annotate", record: "Record" },
    words: { drag: "Drag", click: "Click", wheel: "Wheel", hold: "Hold" },
    rows: {
      selectArea: "Select area", pickWindow: "Pick window", layer: "Outer / inner", copyColor: "Copy colour", measure: "Measure", cancel: "Cancel",
      copy: "Copy", save: "Save", pin: "Pin to screen", undoRedo: "Undo / redo", deleteMark: "Delete mark", wholeScreen: "Whole screen", gif: "MP4 / GIF", collapse: "Hide this",
      rect: "Rectangle", ellipse: "Ellipse", line: "Line", arrow: "Arrow", pen: "Pen", highlighter: "Highlighter", text: "Text", mosaic: "Mosaic", blur: "Blur", spotlight: "Spotlight", number: "Number",
    },
  },
  qr: {
    title: "QR codes in the selection",
    button: (count) => (count > 1 ? `${count} QR codes found` : "QR code found"),
    link: "Link",
    text: "Text",
    open: "Open link",
    copy: "Copy",
    copied: "QR code content copied",
  },
  pinMenu: {
    copy: "Copy",
    save: "Save",
    actualSize: "Actual size",
    clickThrough: "Click through (until pins are hidden and shown)",
    hideAll: "Hide all pins (T)",
    close: "Close (Esc)",
    closeAll: "Close all pins",
    annotate: "Annotate (Space)",
    readText: "Read text and copy (O)",
    turnLeft: "Turn left 90° (1)",
    turnRight: "Turn right 90° (2)",
    flipX: "Flip horizontally (3)",
    flipY: "Flip vertically (4)",
    collapse: "Shrink to an icon (double-click / M)",
    expand: "Restore (double-click / M)",
  },
  pinAnnotate: { done: "Finish annotating (Enter)", cancel: "Discard these annotations (Esc)" },
  pinText: { reading: "Reading the text…", copied: "Text copied", empty: "No text found" },
  pinCopied: "Copied",
  recording: {
    countdown: (seconds) => `Recording in ${seconds}`,
    running: (time) => `Recording ${time}`,
    paused: (time) => `Paused ${time}`,
    pause: "Pause",
    resume: "Resume",
    stop: "Stop and save (Ctrl+Shift+6)",
    cancel: "Cancel",
    saved: (time) => `Recording saved · ${time}`,
    reveal: "Show in folder",
    shelve: "Put on the file shelf",
    shelved: "Put on the file shelf",
    close: "Close",
  },
  delay: {
    countdown: (seconds) => `Screenshot in ${seconds} s`,
    cancel: "Cancel delayed screenshot",
    menu: "Delayed screenshot",
    option: (seconds) => `In ${seconds} s`,
    buttonHint: "Screenshot (right-click for delay)",
  },
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
    instruction: "A note for the agent",
    instructionHint: "Add a note, Enter to send (optional)",
    sendNow: "Send",
    source: "Source: ",
  },
  history: {
    title: "Screenshot history",
    empty: "No screenshots yet",
    emptyHint: "Screenshots you copy, save or pin to the screen stay here.",
    copyHint: "Click to copy, drag out as a file",
    copyLabel: (when) => `Copy the screenshot from ${when}`,
    copied: "Copied",
    copy: "Copy",
    pin: "Pin to screen",
    remove: "Delete",
    today: "Today",
    yesterday: "Yesterday",
    date: (year, month, day) => new Date(year ?? 2000, month - 1, day).toLocaleDateString("en", year ? { year: "numeric", month: "short", day: "numeric" } : { month: "short", day: "numeric" }),
    dayCount: (count) => (count === 1 ? "1 shot" : `${count} shots`),
    tab: "Screenshots",
    search: "Search text in screenshots",
    clearSearch: "Clear search",
    noMatch: (query) => `No screenshot contains “${query}”`,
  },
};
