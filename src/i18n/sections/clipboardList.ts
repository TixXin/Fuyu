export type ClipboardListText = {
  pinned: string;
  dragPin: string;
  pinKeyAction: string;
  pinKeyTitle: string;
  pinKeyHint: (keys: string) => string;
  pinKeyNone: string;
  pinKeyClear: string;
  pinKeyTaken: (label: string) => string;
  pinKeyReserved: string;
  pinKeyPaste: (keys: string) => string;
  pinFavorites: string;
  pinFavoritesHint: (alt: string) => string;
};

export const zhCN: ClipboardListText = {
  pinned: "固定",
  dragPin: "拖动排序",
  pinKeyAction: "设固定键…",
  pinKeyTitle: "按一个字母作固定键",
  pinKeyHint: (keys) => `之后打开剪贴板窗口按 ${keys} 直接粘贴这一条`,
  pinKeyNone: "还没有固定键",
  pinKeyClear: "清掉固定键",
  pinKeyTaken: (label) => `现在给了「${label}」，设给这一条后它让出`,
  pinKeyReserved: "E、I、N、U 在 Mac 上是 ⌥ 的组合键，不能用",
  pinKeyPaste: (keys) => `按 ${keys} 粘贴`,
  pinFavorites: "收藏的条目置顶",
  pinFavoritesHint: (alt) => `剪贴板窗口的「全部」里，收藏的条目排在最上面，可拖动排序；数字键 1–9 跳过它们。动作面板里「设固定键」后按 ${alt} + 字母直接粘贴。`,
};

export const en: ClipboardListText = {
  pinned: "Pinned",
  dragPin: "Drag to reorder",
  pinKeyAction: "Set pin key…",
  pinKeyTitle: "Press a letter for the pin key",
  pinKeyHint: (keys) => `Then press ${keys} in the clipboard window to paste this entry`,
  pinKeyNone: "No pin key yet",
  pinKeyClear: "Clear pin key",
  pinKeyTaken: (label) => `Taken by "${label}", which gives it up`,
  pinKeyReserved: "E, I, N and U start ⌥ accents on the Mac and can't be used",
  pinKeyPaste: (keys) => `Press ${keys} to paste`,
  pinFavorites: "Pin favorites to the top",
  pinFavoritesHint: (alt) => `In the clipboard window's "All", favorites come first and can be dragged into order; the 1–9 keys skip them. Set a pin key from the action panel to paste with ${alt} + a letter.`,
};
