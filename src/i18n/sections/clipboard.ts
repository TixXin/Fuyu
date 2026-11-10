export type ClipboardText = {
  title: string;
  favoriteCount: (count: number) => string;
  expandShortcut: string;
  clear: string;
  confirmClear: string;
  clearHistory: string;
  segments: string;
  all: string;
  favorites: string;
  searchPlaceholder: string;
  searchLabel: string;
  clearSearch: string;
  emptyAll: string;
  emptyFavorites: string;
  emptySearch: string;
  copyBack: string;
  filterByTag: (tag: string) => string;
  /** An image's text read by OCR (C24.9). */
  copyOcrText: string;
  popup: {
    title: string;
    search: string;
    hint: string;
    empty: string;
    quickPaste: (index: number) => string;
    tabs: Record<"history" | "snippets", string>;
    noSnippets: string;
    snippetHint: string;
    sequenceHint: (count: number) => string;
  };
  /** An image as its file: chat apps and Explorer paste the file. */
  copyAsFile: string;
  /** An image as its path in quotes: terminal CLIs such as Claude Code attach it as an image. */
  copyPath: string;
  copy: string;
  copied: string;
  favorite: string;
  favoriteItem: string;
  unfavoriteItem: string;
  delete: string;
  deleteItem: string;
  notePlaceholder: string;
  noteInputLabel: string;
  saveNote: string;
  cancelEditNote: string;
  editNote: (note: string) => string;
  editNoteLabel: string;
  addNoteLabel: string;
  noteFallback: string;
  images: string;
  files: string;
  /** An image entry's first line. */
  imageLabel: (width: number, height: number) => string;
  /** More files than the one named. */
  moreFiles: (count: number) => string;
  emptyHint: string;
  noteAction: string;
  confirmDelete: string;
};

export const zhCN: ClipboardText = {
  title: "剪贴板历史",
  favoriteCount: (count) => `${count} 条收藏`,
  expandShortcut: "展开快捷键",
  clear: "清空",
  confirmClear: "确认清空",
  clearHistory: "清空剪贴板历史",
  segments: "剪贴板栏目",
  all: "全部",
  favorites: "收藏",
  searchPlaceholder: "搜索内容、备注或 #标签",
  searchLabel: "搜索剪贴板内容或备注",
  clearSearch: "清除搜索",
  emptyAll: "复制文本或图片后会出现在这里",
  emptyFavorites: "还没有收藏剪贴记录",
  emptySearch: "没有匹配的剪贴记录",
  copyBack: "复制回剪贴板",
  filterByTag: (tag) => `只看标签 #${tag}`,
  copyOcrText: "复制图片里识别出的文字",
  popup: {
    title: "剪贴板",
    search: "搜索剪贴记录",
    hint: "Enter 粘贴 · Shift+Enter 纯文本 · Ctrl+点击 多选顺序粘贴 · Tab 片段",
    empty: "还没有剪贴记录",
    quickPaste: (index) => `按 ${index} 粘贴`,
    tabs: { history: "历史", snippets: "片段" },
    noSnippets: "还没有片段，在 设置 → 剪贴板 里添加",
    snippetHint: "Enter 粘贴 · Tab 切换 · Esc 关闭",
    sequenceHint: (count) => `已选 ${count} 条 · Enter 开始顺序粘贴 · Esc 取消`,
  },
  copyAsFile: "复制为文件（聊天软件、资源管理器里粘贴成文件）",
  copyPath: "复制图片路径（贴到 Claude Code 等终端里会当成图片）",
  copy: "复制",
  copied: "已复制",
  favorite: "收藏",
  favoriteItem: "收藏剪贴记录",
  unfavoriteItem: "取消收藏剪贴记录",
  delete: "删除",
  deleteItem: "删除剪贴记录",
  notePlaceholder: "备注这是什么，#词 是标签",
  noteInputLabel: "剪贴记录备注",
  saveNote: "保存备注",
  cancelEditNote: "取消编辑备注",
  editNote: (note) => `编辑备注：${note}`,
  editNoteLabel: "添加剪贴记录备注",
  addNoteLabel: "添加剪贴记录备注",
  noteFallback: "备注",
  images: "图片",
  files: "文件",
  imageLabel: (width, height) => `图片 ${width}×${height}`,
  moreFiles: (count) => `+${count} 个文件`,
  emptyHint: "复制的文字、图片和文件都会记在这里，点一条就复制回去。",
  noteAction: "写备注 / 标签",
  confirmDelete: "再点一次删除",
};

export const en: ClipboardText = {
  title: "Clipboard history",
  favoriteCount: (count) => (count === 1 ? "1 favorite" : `${count} favorites`),
  expandShortcut: "Expand shortcut",
  clear: "Clear",
  confirmClear: "Confirm clear",
  clearHistory: "Clear clipboard history",
  segments: "Clipboard tabs",
  all: "All",
  favorites: "Starred",
  searchPlaceholder: "Search content, notes or #tags",
  searchLabel: "Search clipboard content or note",
  clearSearch: "Clear search",
  emptyAll: "Copied text and images show up here",
  emptyFavorites: "No starred entries yet",
  emptySearch: "No matching entries",
  copyBack: "Copy back to clipboard",
  filterByTag: (tag) => `Show only #${tag}`,
  copyOcrText: "Copy the text read in the image",
  popup: {
    title: "Clipboard",
    search: "Search clipboard history",
    hint: "Enter paste · Shift+Enter plain · Ctrl+click picks a sequence · Tab snippets",
    empty: "Nothing copied yet",
    quickPaste: (index) => `Press ${index} to paste`,
    tabs: { history: "History", snippets: "Snippets" },
    noSnippets: "No snippets yet; add them in Settings → Clipboard",
    snippetHint: "Enter paste · Tab switch · Esc close",
    sequenceHint: (count) => `${count} picked · Enter starts pasting them in turn · Esc cancels`,
  },
  copyAsFile: "Copy as a file (chat apps and Explorer paste the file)",
  copyPath: "Copy the image's path (Claude Code and other terminals take it as an image)",
  copy: "Copy",
  copied: "Copied",
  favorite: "Star",
  favoriteItem: "Star entry",
  unfavoriteItem: "Unstar entry",
  delete: "Delete",
  deleteItem: "Delete entry",
  notePlaceholder: "Note what this is; #word is a tag",
  noteInputLabel: "Clipboard entry note",
  saveNote: "Save note",
  cancelEditNote: "Cancel editing note",
  editNote: (note) => `Edit note: ${note}`,
  editNoteLabel: "Add note to clipboard entry",
  addNoteLabel: "Add note to clipboard entry",
  noteFallback: "Note",
  images: "Images",
  files: "Files",
  imageLabel: (width, height) => `Image ${width}×${height}`,
  moreFiles: (count) => `+${count} files`,
  emptyHint: "Text, images and files you copy are kept here; click one to copy it back.",
  noteAction: "Note / tags",
  confirmDelete: "Click again to delete",
};
