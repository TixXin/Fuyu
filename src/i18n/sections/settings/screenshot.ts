export type SettingsScreenshotText = {
  shortcutsTitle: string;
  region: string;
  regionHint: string;
  fullscreen: string;
  fullscreenHint: string;
  /** Under the shortcuts: number row or numpad, and NumLock. */
  shortcutsHint: string;
};

export const zhCN: SettingsScreenshotText = {
  shortcutsTitle: "快捷键",
  region: "截图",
  regionHint: "屏幕定格后，单击选中鼠标下的窗口或控件（滚轮切换到外层或内层），或拖动选择区域；按 Enter 复制到剪贴板，Esc 取消；放大镜下按 C 复制颜色。",
  fullscreen: "截取整个屏幕",
  fullscreenHint: "选中鼠标所在的显示器，按 Enter 复制。",
  shortcutsHint: "主键盘上排的数字和右侧小键盘的数字都可以；用小键盘时要开着 NumLock。",
};

export const en: SettingsScreenshotText = {
  shortcutsTitle: "Shortcuts",
  region: "Screenshot",
  regionHint: "The screen freezes; click the window or control under the pointer (scroll to step out or in) or drag a region, then Enter copies to the clipboard and Esc cancels. Under the magnifier, C copies the colour.",
  fullscreen: "Whole screen",
  fullscreenHint: "Selects the monitor under the pointer; Enter copies it.",
  shortcutsHint: "The digit can come from the number row or the numpad; the numpad needs NumLock on.",
};
