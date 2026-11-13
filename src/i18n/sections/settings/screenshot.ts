type ShortcutAction = "region" | "copy" | "text" | "translate" | "long" | "record" | "fullscreen" | "pins";

export type SettingsScreenshotText = {
  whileCapturingTitle: string;
  guides: string;
  guidesHint: string;
  shortcutsTitle: string;
  actions: Record<ShortcutAction, string>;
  actionHints: Record<ShortcutAction, string>;
  shortcutsHint: string;
  shortcutsHintMac: string;
  shortcutOff: string;
  textHintMac: string;
  regionHintMac: string;
  shortcutInvalidMac: string;
  setShortcut: string;
  turnOffShortcut: (action: string) => string;
  shortcutProblem: Record<"invalid" | "duplicate" | "taken", string>;
  printScreen: string;
  printScreenHint: string;
  afterTitle: string;
  saveFolder: string;
  saveFolderHint: string;
  saveFolderHintMac: string;
  saveFolderPlaceholder: string;
  cardSeconds: string;
  cardSecondsHint: string;
  cardSecondsOption: (seconds: number) => string;
  historyDays: string;
  historyDaysHint: string;
  historyDaysOption: (days: number) => string;
  recordTitle: string;
  recordFps: string;
  recordFpsHint: string;
  recordFpsOption: (fps: number) => string;
  recordQuality: string;
  recordQualityHint: string;
  recordQualities: Record<"standard" | "high", string>;
  recordSystemAudio: string;
  recordSystemAudioHint: string;
  recordMicrophone: string;
  recordMicrophoneHint: string;
  recordFormat: string;
  recordFormatHint: string;
  recordFormats: Record<"mp4" | "gif", string>;
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
    long: "长截图",
    record: "录屏",
    fullscreen: "截取整个屏幕",
    pins: "隐藏或显示所有贴图",
  },
  actionHints: {
    region: "屏幕定格后，单击选中鼠标下的窗口或控件（滚轮切换到外层或内层），或拖动选择区域；工具栏里可以画矩形、箭头、文字、马赛克等标注（Ctrl+Z 撤销）；Enter 复制，Ctrl+S 保存，T 贴到屏幕上，Esc 取消；放大镜下按 C 复制颜色。",
    copy: "单击选中窗口或控件，或拖动选择区域，松开鼠标就复制，不出工具栏。",
    text: "选好区域就用 Windows 自带的文字识别读出文字并复制，浮屿上显示识别结果，点它在翻译里打开。",
    translate: "选好区域就识别文字，交给快捷翻译，浮屿上显示译文。需要打开翻译功能。",
    long: "选好要滚动的区域（网页、聊天记录、文档），浮屿在区域中间往下滚，逐屏拼成一张长图并复制；滚到底、高度到 2 万像素或按 Esc 时结束。固定在顶部和底部的栏只留一份。",
    record: "选好区域、窗口或整个屏幕（按 F），3 秒后开始录成 MP4，带系统声音；浮屿上显示时长，可以暂停，再按一次快捷键停止。录好的视频在「视频」下的「浮屿录屏」文件夹，浮屿自己不会被录进去。",
    fullscreen: "选中鼠标所在的显示器，按 Enter 复制。",
    pins: "在任何地方都能用。不设的话，在贴图或浮屿上按 T 也能隐藏或显示。",
  },
  shortcutsHint: "点按钮后按下新的组合键；Esc 放弃。Ctrl+Shift+数字时，右侧小键盘的数字也可以（要开着 NumLock）。",
  shortcutsHintMac: "点按钮后按下新的组合键；Esc 放弃。",
  shortcutOff: "未设置",
  textHintMac: "选好区域就用 macOS 自带的文字识别读出文字并复制，浮屿上显示识别结果，点它在翻译里打开。",
  regionHintMac: "屏幕定格后，单击选中鼠标下的窗口或控件（滚轮切换到外层或内层），或拖动选择区域；工具栏里可以画矩形、箭头、文字、马赛克等标注（⌘Z 撤销）；↩ 复制，⌘S 保存，T 贴到屏幕上，Esc 取消；放大镜下按 C 复制颜色。",
  shortcutInvalidMac: "这个组合键用不了：要带 ⌃、⌥、⇧ 或 ⌘，再加一个字母、数字或功能键。",
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
  saveFolderHintMac: "⌘S 和贴图的「保存」放到这里，文件名带时间。要写完整路径，例如 /Users/你的用户名/Desktop/截图；留空就是「图片 › 浮屿截图」。",
  saveFolderPlaceholder: "图片 › 浮屿截图",
  cardSeconds: "岛上的截图卡片",
  cardSecondsHint: "复制或保存后，浮屿顶部显示缩略图：可以拖到别的应用、放进文件中转、发给 Agent。鼠标停在上面时不会收起。",
  cardSecondsOption: (seconds) => (seconds === 0 ? "不显示" : `显示 ${seconds} 秒`),
  historyDays: "截图历史保留",
  historyDaysHint: "复制、保存、贴图过的截图留在浮屿的「截图」页，可以再复制、贴到屏幕上或拖出去；最多 100 张，超过天数的自动删掉。",
  historyDaysOption: (days) => `${days} 天`,
  recordTitle: "录屏",
  recordFps: "帧率",
  recordFpsHint: "60 帧更流畅，文件大一些。GIF 固定 15 帧。",
  recordFpsOption: (fps) => `${fps} 帧/秒`,
  recordQuality: "画质",
  recordQualityHint: "高画质的码率是标准的两倍，文字和细线更清楚，文件也大一倍。",
  recordQualities: { standard: "标准", high: "高" },
  recordSystemAudio: "录系统声音",
  recordSystemAudioHint: "电脑里正在播放的声音。GIF 没有声音。",
  recordMicrophone: "录麦克风",
  recordMicrophoneHint: "用系统默认的麦克风。打开时 Windows 会在任务栏显示麦克风正在使用。",
  recordFormat: "默认格式",
  recordFormatHint: "录屏时选区之前按 G 可以临时换成另一种。视频放在「视频 › 浮屿录屏」。",
  recordFormats: { mp4: "MP4 视频", gif: "GIF 动图" },
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
    long: "Long screenshot",
    record: "Screen recording",
    fullscreen: "Whole screen",
    pins: "Hide or show all pins",
  },
  actionHints: {
    region: "The screen freezes; click the window or control under the pointer (scroll to step out or in) or drag a region. The toolbar draws rectangles, arrows, text, mosaic and more (Ctrl+Z undoes). Enter copies, Ctrl+S saves, T pins it to the screen, Esc cancels; under the magnifier, C copies the colour.",
    copy: "Click a window or control or drag a region; it is copied as soon as you let go, without the toolbar.",
    text: "Once a region is chosen, Windows' own text recognition reads it and the text is copied; the island shows it, and a click opens it in the translator.",
    translate: "Once a region is chosen its text is read and handed to quick translation; the island shows the translation. Needs translation turned on.",
    long: "Choose the area that scrolls (a web page, a chat, a document); Fuyu scrolls it from the middle and stitches one tall picture, then copies it. It stops at the end, at 20,000 px or on Esc. Bars fixed to the top and bottom appear once.",
    record: "Choose an area, a window or the whole screen (press F); recording to MP4 with system sound starts after 3 seconds. The island shows the time and can pause; press the shortcut again to stop. Videos go to the Fuyu Recordings folder under Videos, and Fuyu itself is left out of them.",
    fullscreen: "Selects the monitor under the pointer; Enter copies it.",
    pins: "Works anywhere. Without it, T on a pin or the island hides or shows them too.",
  },
  shortcutsHint: "Click a button, then press the new keys; Esc gives up. With Ctrl+Shift+digit, the numpad digit works too (with NumLock on).",
  shortcutsHintMac: "Click a button, then press the new keys; Esc gives up.",
  shortcutOff: "Not set",
  textHintMac: "Once a region is chosen, macOS's own text recognition reads it and the text is copied; the island shows it, and a click opens it in the translator.",
  regionHintMac: "The screen freezes; click the window or control under the pointer (scroll to step out or in) or drag a region. The toolbar draws rectangles, arrows, text, mosaic and more (⌘Z undoes). Return copies, ⌘S saves, T pins it to the screen, Esc cancels; under the magnifier, C copies the colour.",
  shortcutInvalidMac: "These keys can't be used: add ⌃, ⌥, ⇧ or ⌘ to a letter, digit or function key.",
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
  saveFolderHintMac: "Where ⌘S and a pin's Save put files, named by the time. Use a full path such as /Users/your-name/Desktop/Screenshots; empty means Pictures › Fuyu Screenshots.",
  saveFolderPlaceholder: "Pictures › Fuyu Screenshots",
  cardSeconds: "Screenshot card on the island",
  cardSecondsHint: "After a copy or save, the island shows a thumbnail you can drag into another app, put on the file shelf or send to an agent. It stays while the pointer is on it.",
  cardSecondsOption: (seconds) => (seconds === 0 ? "Don't show" : `Show for ${seconds} s`),
  historyDays: "Keep screenshot history for",
  historyDaysHint: "Screenshots you copied, saved or pinned stay on the island's Screenshots page to copy, pin or drag out again; up to 100, older ones are deleted.",
  historyDaysOption: (days) => (days === 1 ? "1 day" : `${days} days`),
  recordTitle: "Screen recording",
  recordFps: "Frame rate",
  recordFpsHint: "60 is smoother and makes bigger files. GIFs are always 15.",
  recordFpsOption: (fps) => `${fps} fps`,
  recordQuality: "Quality",
  recordQualityHint: "High uses twice the bitrate of standard: sharper text and thin lines, files twice as big.",
  recordQualities: { standard: "Standard", high: "High" },
  recordSystemAudio: "Record system sound",
  recordSystemAudioHint: "What the computer is playing. GIFs have no sound.",
  recordMicrophone: "Record the microphone",
  recordMicrophoneHint: "Uses the default microphone. Windows shows that the microphone is in use while it is on.",
  recordFormat: "Default format",
  recordFormatHint: "Press G before choosing the area to switch for one recording. Videos go to Videos › Fuyu Recordings.",
  recordFormats: { mp4: "MP4 video", gif: "GIF animation" },
};
