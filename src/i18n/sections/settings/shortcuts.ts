export type SettingsShortcutsText = {
  globalHint: string;
  openTranslation: string;
  featureTitle: string;
  allShortcuts: string;
  openFeaturePage: string;
  featureOff: (feature: string) => string;
  turnOn: string;
  finderTitle: string;
  finderDescription: string;
  finderIdle: string;
  finderPress: string;
  finderFree: (shortcut: string) => string;
  finderUsed: (shortcut: string, owner: string, page: string) => string;
  finderOpen: string;
  approvalTitle: string;
  approvalHint: string;
  islandTitle: string;
  collapse: string;
  moveIsland: string;
  altDrag: string;
  altDragMac: string;
  resizePanel: string;
  holdPanelMac: string;
  altDragEdge: string;
  holdControlMac: string;
  inputTitle: string;
  translate: string;
  newLine: string;
  pasteClipboard: string;
  clipboardWindowTitle: string;
  clipboardPreview: string;
  clipboardSnippetsTab: string;
  clipboardPlainPaste: string;
  clipboardAiRewrite: string;
  clipboardQuickPick: string;
  taken: (shortcut: string, owner: string) => string;
  reset: (shortcut: string) => string;
  pluginTitle: string;
  pluginHint: string;
  pluginNone: string;
  pluginNotSet: string;
  pluginOff: string;
  pluginRecord: string;
  pluginPressKeys: string;
  pluginTurnOff: string;
  pluginClear: string;
  pluginInUse: string;
};

export const zhCN: SettingsShortcutsText = {
  globalHint: "全局快捷键，在任何程序里都能按。点击按钮后按下新的组合键，按 Esc 取消。",
  openTranslation: "打开快捷翻译",
  featureTitle: "快捷键",
  allShortcuts: "全部快捷键 ›",
  openFeaturePage: "设置页 ›",
  featureOff: (feature) => `${feature}已关闭，开启后这些快捷键才会生效。`,
  turnOn: "开启",
  finderTitle: "按键查询",
  finderDescription: "按下一组组合键，看看浮屿里是谁在用它。",
  finderIdle: "点击后按键",
  finderPress: "请按组合键…",
  finderFree: (shortcut) => `浮屿没有用到 ${shortcut}，可以拿来设置。`,
  finderUsed: (shortcut, owner, page) => `${shortcut} 已用于「${owner}」（${page}）。`,
  finderOpen: "前往",
  approvalTitle: "AI Agent 审批卡片",
  approvalHint: "只在审批卡片显示时占用，卡片关闭就释放，不能修改。",
  islandTitle: "岛上操作",
  collapse: "收起展开的岛",
  moveIsland: "移动岛屿",
  altDrag: "Alt + 拖动",
  altDragMac: "⌃ Control + 拖动",
  resizePanel: "调整面板宽高（按住 Alt 时面板不收起）",
  holdPanelMac: "展开的面板不收起",
  altDragEdge: "Alt + 拖动面板边缘",
  holdControlMac: "按住 ⌃ Control",
  inputTitle: "翻译输入框",
  translate: "翻译",
  newLine: "换行",
  pasteClipboard: "填入剪贴板（独立窗口）",
  clipboardWindowTitle: "剪贴板独立窗口",
  clipboardPreview: "空格大图 / 全文预览",
  clipboardSnippetsTab: "切换历史与常用语",
  clipboardPlainPaste: "粘贴为纯文本",
  clipboardAiRewrite: "AI 改写或总结",
  clipboardQuickPick: "快速粘贴第 1–9 条",
  taken: (shortcut, owner) => `${shortcut} 已被「${owner}」使用，请换一个。`,
  reset: (shortcut) => `恢复默认（${shortcut}）`,
  pluginTitle: "插件快捷键",
  pluginHint: "已开启的插件的命令。可以改成别的组合键、关闭，或者恢复插件自带的快捷键；没有快捷键的命令也可以设一个。",
  pluginNone: "已开启的插件都没有命令。",
  pluginNotSet: "未设置",
  pluginOff: "已关闭",
  pluginRecord: "设置快捷键",
  pluginPressKeys: "请按组合键…",
  pluginTurnOff: "关闭这个快捷键",
  pluginClear: "清除快捷键",
  pluginInUse: "这个快捷键已被其他程序占用，没有生效，请换一个。",
};

export const en: SettingsShortcutsText = {
  globalHint: "Global shortcuts work in any program. Click a button, then press a new key combination; Esc cancels.",
  openTranslation: "Open quick translation",
  featureTitle: "Shortcuts",
  allShortcuts: "All shortcuts ›",
  openFeaturePage: "Settings ›",
  featureOff: (feature) => `${feature} is off; its shortcuts work once it is on.`,
  turnOn: "Turn on",
  finderTitle: "Look up keys",
  finderDescription: "Press a key combination to see what in Fuyu uses it.",
  finderIdle: "Click, then press",
  finderPress: "Press keys…",
  finderFree: (shortcut) => `Fuyu does not use ${shortcut}; it is free to set.`,
  finderUsed: (shortcut, owner, page) => `${shortcut} is used by "${owner}" (${page}).`,
  finderOpen: "Open",
  approvalTitle: "Agent approval card",
  approvalHint: "Held only while an approval card shows and released when it closes; they can't be changed.",
  islandTitle: "On the island",
  collapse: "Collapse the expanded island",
  moveIsland: "Move the island",
  altDrag: "Alt + drag",
  altDragMac: "⌃ Control + drag",
  resizePanel: "Resize the panel (it stays open while Alt is held)",
  holdPanelMac: "Keep the open panel from closing",
  altDragEdge: "Alt + drag the panel's edge",
  holdControlMac: "Hold ⌃ Control",
  inputTitle: "Translation input",
  translate: "Translate",
  newLine: "New line",
  pasteClipboard: "Fill from the clipboard (window only)",
  clipboardWindowTitle: "Clipboard window",
  clipboardPreview: "Spacebar peek",
  clipboardSnippetsTab: "Switch history and snippets",
  clipboardPlainPaste: "Paste as plain text",
  clipboardAiRewrite: "AI rewrite or summary",
  clipboardQuickPick: "Quick paste entry 1–9",
  taken: (shortcut, owner) => `${shortcut} is already used by "${owner}". Choose another.`,
  reset: (shortcut) => `Reset to default (${shortcut})`,
  pluginTitle: "Plugin shortcuts",
  pluginHint: "Commands of the plugins that are on. Change a shortcut, turn it off, or go back to the plugin's own; commands without one can get one too.",
  pluginNone: "None of the plugins that are on has commands.",
  pluginNotSet: "Not set",
  pluginOff: "Off",
  pluginRecord: "Set shortcut",
  pluginPressKeys: "Press keys…",
  pluginTurnOff: "Turn this shortcut off",
  pluginClear: "Clear the shortcut",
  pluginInUse: "Another app already uses this shortcut, so it does not work. Choose another.",
};
