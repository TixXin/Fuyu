export type SettingsPageShortcutsText = {
  title: string;
  hint: string;
  hintMac: string;
  digitModifiers: string;
  nextPage: string;
  previousPage: string;
  pressDigit: string;
  pressKeys: string;
  hoverKeyboard: string;
  hoverKeyboardHint: string;
};

export const zhCN: SettingsPageShortcutsText = {
  title: "页面切换",
  hint: "数字键从左到右打开页面。岛有焦点时生效：点一下岛，或用快捷键打开它。Alt+Tab 和 Win+Tab 由 Windows 使用，不能设成翻页。",
  hintMac: "数字键从左到右打开页面。岛有焦点时生效：点一下岛，或用快捷键打开它。⌘⇥ 和 ⌥⇥ 不能设成翻页。",
  digitModifiers: "数字切页",
  nextPage: "下一页",
  previousPage: "上一页",
  pressDigit: "按下修饰键和数字",
  pressKeys: "按下快捷键",
  hoverKeyboard: "悬停时接管键盘",
  hoverKeyboardHint: "鼠标停在展开的岛上就能直接按翻页键。会从正在用的窗口拿走键盘焦点，移开后还回去",
};

export const en: SettingsPageShortcutsText = {
  title: "Page switching",
  hint: "Number keys open pages from left to right. They work while the island has focus: click it, or open it with a shortcut. Alt+Tab and Win+Tab belong to Windows and can't turn the page.",
  hintMac: "Number keys open pages from left to right. They work while the island has focus: click it, or open it with a shortcut. ⌘⇥ and ⌥⇥ can't turn the page.",
  digitModifiers: "Number keys",
  nextPage: "Next page",
  previousPage: "Previous page",
  pressDigit: "Press the modifier and a number",
  pressKeys: "Press the shortcut",
  hoverKeyboard: "Take the keyboard on hover",
  hoverKeyboardHint: "Page keys work as soon as the cursor rests on the expanded island. This takes keyboard focus from the window you are using and hands it back when the cursor leaves",
};
