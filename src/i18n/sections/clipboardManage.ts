export type ClipboardManageText = {
  expand: string;
  collapse: string;
  label: string;
  count: (count: number) => string;
  selected: (count: number) => string;
  selectAll: string;
  selectNone: string;
  pick: (label: string) => string;
  deleteSelected: (count: number) => string;
  favoritesIncluded: (count: number) => string;
  deleted: (count: number) => string;
  undo: string;
  hintClick: string;
  hintToggle: string;
  hintRange: string;
  hintAll: string;
  hintDelete: string;
  nothingFocused: string;
  failed: string;
};

export const zhCN: ClipboardManageText = {
  expand: "展开成管理视图",
  collapse: "收起成小窗口",
  label: "管理剪贴板历史",
  count: (count) => `${count} 条`,
  selected: (count) => `已选 ${count} 条`,
  selectAll: "全选",
  selectNone: "取消选择",
  pick: (label) => `选择：${label}`,
  deleteSelected: (count) => `删除 ${count} 条`,
  favoritesIncluded: (count) => `含 ${count} 条收藏`,
  deleted: (count) => `已删除 ${count} 条`,
  undo: "撤销",
  hintClick: "点击选中",
  hintToggle: "点击加选",
  hintRange: "点击选一段",
  hintAll: "全选",
  hintDelete: "删除",
  nothingFocused: "选中一条，这里显示完整内容",
  failed: "没能删除，再试一次",
};

export const en: ClipboardManageText = {
  expand: "Expand into the manager",
  collapse: "Back to the small window",
  label: "Manage clipboard history",
  count: (count) => (count === 1 ? "1 entry" : `${count} entries`),
  selected: (count) => `${count} selected`,
  selectAll: "Select all",
  selectNone: "Select none",
  pick: (label) => `Select: ${label}`,
  deleteSelected: (count) => `Delete ${count}`,
  favoritesIncluded: (count) => (count === 1 ? "1 starred" : `${count} starred`),
  deleted: (count) => (count === 1 ? "Deleted 1 entry" : `Deleted ${count} entries`),
  undo: "Undo",
  hintClick: "Click to select",
  hintToggle: "Click to add",
  hintRange: "Click for a range",
  hintAll: "All",
  hintDelete: "Delete",
  nothingFocused: "Pick an entry to see all of it here",
  failed: "Could not delete; try again",
};
