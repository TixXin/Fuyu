type ShortcutAction = "region" | "copy" | "text" | "translate" | "fullscreen" | "pins";

export type SettingsScreenshotText = {
  whileCapturingTitle: string;
  guides: string;
  guidesHint: string;
  shortcutsTitle: string;
  actions: Record<ShortcutAction, string>;
  actionHints: Record<ShortcutAction, string>;
  shortcutsHint: string;
  shortcutOff: string;
  setShortcut: string;
  turnOffShortcut: (action: string) => string;
  shortcutProblem: Record<"invalid" | "duplicate" | "taken", string>;
  printScreen: string;
  printScreenHint: string;
  afterTitle: string;
  saveFolder: string;
  saveFolderHint: string;
  saveFolderPlaceholder: string;
  cardSeconds: string;
  cardSecondsHint: string;
  cardSecondsOption: (seconds: number) => string;
};

export const zhCN: SettingsScreenshotText = {
  whileCapturingTitle: "截图时",
  guides: "显示辅助线",
  guidesHint: "虚线贯穿整个屏幕，方便对齐边缘：一横一竖跟着鼠标（选好区域后隐藏），选区的四条边也各延长一条。",
  shortcutsTitle: "快捷键",
  actions: {
    region: "截图",
    copy: "截图并复制",
    text: "截图并识别文字",
    translate: "截图并翻译",
    fullscreen: "截取整个屏幕",
    pins: "隐藏或显示所有贴图",
  },
  actionHints: {
    region: "屏幕定格后，单击选中鼠标下的窗口或控件（滚轮切换到外层或内层），或拖动选择区域；工具栏里可以画矩形、箭头、文字、马赛克等标注（Ctrl+Z 撤销）；Enter 复制，Ctrl+S 保存，T 贴到屏幕上，Esc 取消；放大镜下按 C 复制颜色。",
    copy: "单击选中窗口或控件，或拖动选择区域，松开鼠标就复制，不出工具栏。",
    text: "选好区域就用 Windows 自带的文字识别读出文字并复制，浮屿上显示识别结果，点它在翻译里打开。",
    translate: "选好区域就识别文字，交给快捷翻译，浮屿上显示译文。需要打开翻译功能。",
    fullscreen: "选中鼠标所在的显示器，按 Enter 复制。",
    pins: "在任何地方都能用。不设的话，在贴图或浮屿上按 T 也能隐藏或显示。",
  },
  shortcutsHint: "点按钮后按下新的组合键；Esc 放弃。Ctrl+Shift+数字时，右侧小键盘的数字也可以（要开着 NumLock）。",
  shortcutOff: "未设置",
  setShortcut: "设置",
  turnOffShortcut: (action) => `关闭「${action}」的快捷键`,
  shortcutProblem: {
    invalid: "这个组合键用不了：要带 Ctrl、Alt、Shift 或 Win，再加一个字母、数字或功能键。",
    duplicate: "和上面另一项用了同一个组合键，这一项没有生效。",
    taken: "这个组合键被别的程序占用了，换一个。",
  },
  printScreen: "按 PrintScreen 截图",
  printScreenHint: "单独按 PrintScreen 时打开浮屿的截图，不再交给系统截图工具。Alt+PrintScreen 等组合键不受影响。",
  afterTitle: "截完之后",
  saveFolder: "保存位置",
  saveFolderHint: "Ctrl+S 和贴图的「保存」放到这里，文件名带时间。要写完整路径，例如 D:\\截图；留空就是「图片 › 浮屿截图」。",
  saveFolderPlaceholder: "图片 › 浮屿截图",
  cardSeconds: "岛上的截图卡片",
  cardSecondsHint: "复制或保存后，浮屿顶部显示缩略图：可以拖到别的应用、放进文件中转、发给 Agent。鼠标停在上面时不会收起。",
  cardSecondsOption: (seconds) => (seconds === 0 ? "不显示" : `显示 ${seconds} 秒`),
};

export const en: SettingsScreenshotText = {
  whileCapturingTitle: "While capturing",
  guides: "Show guide lines",
  guidesHint: "Dashed lines across the screen for lining up edges: one each way through the pointer (hidden once a region is chosen), and one along each edge of the selection.",
  shortcutsTitle: "Shortcuts",
  actions: {
    region: "Screenshot",
    copy: "Screenshot and copy",
    text: "Screenshot and read text",
    translate: "Screenshot and translate",
    fullscreen: "Whole screen",
    pins: "Hide or show all pins",
  },
  actionHints: {
    region: "The screen freezes; click the window or control under the pointer (scroll to step out or in) or drag a region. The toolbar draws rectangles, arrows, text, mosaic and more (Ctrl+Z undoes). Enter copies, Ctrl+S saves, T pins it to the screen, Esc cancels; under the magnifier, C copies the colour.",
    copy: "Click a window or control or drag a region; it is copied as soon as you let go, without the toolbar.",
    text: "Once a region is chosen, Windows' own text recognition reads it and the text is copied; the island shows it, and a click opens it in the translator.",
    translate: "Once a region is chosen its text is read and handed to quick translation; the island shows the translation. Needs translation turned on.",
    fullscreen: "Selects the monitor under the pointer; Enter copies it.",
    pins: "Works anywhere. Without it, T on a pin or the island hides or shows them too.",
  },
  shortcutsHint: "Click a button, then press the new keys; Esc gives up. With Ctrl+Shift+digit, the numpad digit works too (with NumLock on).",
  shortcutOff: "Not set",
  setShortcut: "Set",
  turnOffShortcut: (action) => `Turn off the shortcut for ${action}`,
  shortcutProblem: {
    invalid: "These keys can't be used: add Ctrl, Alt, Shift or Win to a letter, digit or function key.",
    duplicate: "Another row above uses the same keys, so this one is not active.",
    taken: "Another app already uses these keys. Pick different ones.",
  },
  printScreen: "Screenshot with PrintScreen",
  printScreenHint: "PrintScreen on its own opens Fuyu's screenshot instead of the Windows snipping tool. Alt+PrintScreen and other combinations are left alone.",
  afterTitle: "After capturing",
  saveFolder: "Save to",
  saveFolderHint: "Where Ctrl+S and a pin's Save put files, named by the time. Use a full path such as D:\\Screenshots; empty means Pictures › Fuyu Screenshots.",
  saveFolderPlaceholder: "Pictures › Fuyu Screenshots",
  cardSeconds: "Screenshot card on the island",
  cardSecondsHint: "After a copy or save, the island shows a thumbnail you can drag into another app, put on the file shelf or send to an agent. It stays while the pointer is on it.",
  cardSecondsOption: (seconds) => (seconds === 0 ? "Don't show" : `Show for ${seconds} s`),
};
