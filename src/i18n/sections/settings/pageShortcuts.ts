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
  arrows: string;
  arrowsHint: string;
  arrowKeys: string;
  arrowKeysHint: string;
  swipe: string;
  swipeHint: string;
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
  hoverKeyboardHint: "鼠标停在岛上就能直接按翻页键，收起时按 ↓ 展开。会从正在用的窗口拿走键盘焦点，移开后还回去",
  arrows: "面板两侧显示翻页箭头",
  arrowsHint: "鼠标移进面板时左右两边淡淡出现，放上去点一下切到上一页或下一页",
  arrowKeys: "方向键 / Tab 翻页和展开收起",
  arrowKeysHint: "面板里 ← → 或 Tab / Shift+Tab 翻页，↑ 收起（内容滚动过时先回到顶部）；岛有焦点时 ↓ 或回车展开。输入框里有字时不生效",
  swipe: "触控板左右滑动翻页",
  swipeHint: "在面板上两指往左滑是下一页、往右滑是上一页，一次滑动只翻一页；能左右滚动的地方（比如首页的多页组件）照常滚动",
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
  hoverKeyboardHint: "Page keys work as soon as the cursor rests on the island, and ↓ opens it when collapsed. This takes keyboard focus from the window you are using and hands it back when the cursor leaves",
  arrows: "Page arrows beside the panel",
  arrowsHint: "Faint arrows appear on both sides when the cursor enters the panel; click one for the previous or next page",
  arrowKeys: "Arrow keys and Tab turn pages and open or close",
  arrowKeysHint: "In the panel, ← → or Tab / Shift+Tab turn pages and ↑ closes it (scrolling back to the top first). ↓ or Enter opens the island while it has focus. Not while a text box has text in it",
  swipe: "Swipe sideways to turn pages",
  swipeHint: "On the panel, swipe two fingers left for the next page and right for the previous one, one page per swipe. Areas that scroll sideways (such as a multi-page widget on the Home page) scroll as before",
};
