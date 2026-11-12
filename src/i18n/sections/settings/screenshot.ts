export type SettingsScreenshotText = {
  whileCapturingTitle: string;
  guides: string;
  guidesHint: string;
  shortcutsTitle: string;
  region: string;
  regionHint: string;
  copy: string;
  copyHint: string;
  text: string;
  textHint: string;
  translate: string;
  translateHint: string;
  fullscreen: string;
  fullscreenHint: string;
  /** Under the shortcuts: number row or numpad, and NumLock. */
  shortcutsHint: string;
};

export const zhCN: SettingsScreenshotText = {
  whileCapturingTitle: "截图时",
  guides: "显示辅助线",
  guidesHint: "虚线贯穿整个屏幕，方便对齐边缘：一横一竖跟着鼠标（选好区域后隐藏），选区的四条边也各延长一条。",
  shortcutsTitle: "快捷键",
  region: "截图",
  regionHint: "屏幕定格后，单击选中鼠标下的窗口或控件（滚轮切换到外层或内层），或拖动选择区域；工具栏里可以画矩形、箭头、文字、马赛克等标注（Ctrl+Z 撤销）；按 Enter 复制到剪贴板（图片和 PNG 文件，聊天软件、画图、终端都能贴），Ctrl+S 保存到「图片 › 浮屿截图」，T 贴到屏幕上，Esc 取消；放大镜下按 C 复制颜色。贴图可以拖动，滚轮缩放，Ctrl+滚轮调透明度，右键有更多操作；在贴图或浮屿上按 T 隐藏或显示所有贴图。",
  copy: "截图并复制",
  copyHint: "单击选中窗口或控件，或拖动选择区域，松开鼠标就复制，不出工具栏。",
  text: "截图并识别文字",
  textHint: "选好区域就用 Windows 自带的文字识别读出文字并复制，浮屿上显示识别结果，点它在翻译里打开。工具栏里的「识别文字」也一样。",
  translate: "截图并翻译",
  translateHint: "选好区域就识别文字，交给快捷翻译，浮屿上显示译文。需要打开翻译功能。",
  fullscreen: "截取整个屏幕",
  fullscreenHint: "选中鼠标所在的显示器，按 Enter 复制。",
  shortcutsHint: "主键盘上排的数字和右侧小键盘的数字都可以；用小键盘时要开着 NumLock。",
};

export const en: SettingsScreenshotText = {
  whileCapturingTitle: "While capturing",
  guides: "Show guide lines",
  guidesHint: "Dashed lines across the screen for lining up edges: one each way through the pointer (hidden once a region is chosen), and one along each edge of the selection.",
  shortcutsTitle: "Shortcuts",
  region: "Screenshot",
  regionHint: "The screen freezes; click the window or control under the pointer (scroll to step out or in) or drag a region; the toolbar draws rectangles, arrows, text, mosaic and more (Ctrl+Z undoes). Enter copies to the clipboard (as a picture and a PNG file, for chat apps, Paint and terminals alike), Ctrl+S saves to Pictures › Fuyu Screenshots, T pins it to the screen and Esc cancels. Under the magnifier, C copies the colour. Drag a pin to move it, scroll to zoom, Ctrl + scroll to fade it, right-click for more; T on a pin or the island hides or shows all pins.",
  copy: "Screenshot and copy",
  copyHint: "Click a window or control or drag a region; it is copied as soon as you let go, without the toolbar.",
  text: "Screenshot and read text",
  textHint: "Once a region is chosen, Windows' own text recognition reads it and the text is copied; the island shows it, and a click opens it in the translator. The toolbar's Read text does the same.",
  translate: "Screenshot and translate",
  translateHint: "Once a region is chosen its text is read and handed to quick translation; the island shows the translation. Needs translation turned on.",
  fullscreen: "Whole screen",
  fullscreenHint: "Selects the monitor under the pointer; Enter copies it.",
  shortcutsHint: "The digit can come from the number row or the numpad; the numpad needs NumLock on.",
};
