export type FileShelfText = {
  title: string;
  clear: string;
  confirmClear: string;
  empty: string;
  dropHint: string;
  folder: string;
  missing: string;
  copyItem: string;
  copied: string;
  reveal: string;
  removeItem: string;
  alreadyOnShelf: string;
  unreachable: string;
  pin: string;
  unpin: string;
  searchPlaceholder: string;
  searchLabel: string;
  clearSearch: string;
  emptySearch: string;
  selectedCount: (count: number) => string;
  copySelected: string;
  removeSelected: string;
  clearSelection: string;
  all: string;
  pinned: string;
  emptyHint: string;
  open: string;
  /** The selection bar's short "remove from shelf". */
  remove: string;
  copy: string;
};

export const zhCN: FileShelfText = {
  title: "文件中转",
  clear: "清空文件中转",
  confirmClear: "确认清空（不会删除文件）",
  empty: "把文件拖到岛上暂存",
  dropHint: "松开鼠标，加入文件中转",
  folder: "文件夹",
  missing: "已失效",
  copyItem: "复制文件，可直接粘贴",
  copied: "已复制",
  reveal: "在文件夹中显示",
  removeItem: "从文件中转移除（不会删除文件）",
  alreadyOnShelf: "已在列表中",
  unreachable: "无法访问",
  pin: "置顶（不会被自动清理）",
  unpin: "取消置顶",
  searchPlaceholder: "搜索文件名或路径",
  searchLabel: "搜索文件中转",
  clearSearch: "清除搜索",
  emptySearch: "没有匹配的文件",
  selectedCount: (count) => `已选 ${count} 个`,
  copySelected: "复制所选文件",
  removeSelected: "从文件中转移除所选（不会删除文件）",
  clearSelection: "取消选择",
  all: "全部",
  pinned: "置顶",
  emptyHint: "换到别的窗口后再拖出去、复制或打开。只存路径，不复制文件。",
  open: "打开",
  remove: "移除",
  copy: "复制",
};

export const en: FileShelfText = {
  title: "File shelf",
  clear: "Clear shelf",
  confirmClear: "Confirm clear (files are kept)",
  empty: "Drop files on the island to keep them here",
  dropHint: "Release to add to the shelf",
  folder: "Folder",
  missing: "Missing",
  copyItem: "Copy the file to paste elsewhere",
  copied: "Copied",
  reveal: "Show in folder",
  removeItem: "Remove from shelf (the file is kept)",
  alreadyOnShelf: "Already on the shelf",
  unreachable: "Unavailable",
  pin: "Pin (kept by auto cleanup)",
  unpin: "Unpin",
  searchPlaceholder: "Search name or path",
  searchLabel: "Search the file shelf",
  clearSearch: "Clear search",
  emptySearch: "No matching files",
  selectedCount: (count) => `${count} selected`,
  copySelected: "Copy selected files",
  removeSelected: "Remove selected from shelf (files are kept)",
  clearSelection: "Clear selection",
  all: "All",
  pinned: "Pinned",
  emptyHint: "Switch windows, then drag them out, copy or open them. Only the paths are kept; files are not copied.",
  open: "Open",
  remove: "Remove",
  copy: "Copy",
};
