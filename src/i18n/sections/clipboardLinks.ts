export type ClipboardLinksText = {
  chip: string;
  label: string;
  count: (count: number) => string;
  empty: string;
  emptyHint: string;
  open: (title: string) => string;
  remove: string;
  drag: string;
  dragHint: string;
  bookmark: string;
  bookmarked: string;
  linkCopied: (summary: string) => string;
  failed: string;
  settings: {
    title: string;
    notice: string;
    noticeHint: string;
    matching: string;
    matchingOptions: Record<"any" | "web", string>;
    blocked: string;
    blockedHint: string;
    only: string;
    onlyHint: string;
    sitesPlaceholder: string;
    iconsHint: string;
    export: string;
    exportHint: string;
    exportAction: string;
    import: string;
    importHint: string;
    importAction: string;
    exported: string;
    imported: (count: number) => string;
    failed: string;
    show: string;
    showMac: string;
  };
};

export const zhCN: ClipboardLinksText = {
  chip: "书签",
  label: "链接书签",
  count: (count) => `${count} 个书签`,
  empty: "还没有书签",
  emptyHint: "复制链接后，点岛上卡片里的书签按钮；或在剪贴板列表的「⋯」里加入书签。",
  open: (title) => `打开 ${title}`,
  remove: "删除书签",
  drag: "拖动排序",
  dragHint: "拖动或按 ↑↓ 调整顺序",
  bookmark: "加入书签",
  bookmarked: "已加入书签",
  linkCopied: (summary) => `复制了链接 · ${summary}`,
  failed: "书签没能保存",
  settings: {
    title: "链接书签",
    notice: "复制链接时在岛上提示",
    noticeHint: "在任何地方复制了网址，收起的岛上弹一条，点书签按钮就存进剪贴板页的「书签」。",
    matching: "识别哪些链接",
    matchingOptions: { any: "所有网址", web: "只认 http(s):// 开头的" },
    blocked: "这些网站不提示",
    blockedHint: "填域名，用逗号、空格或换行分开；子域名一起算，例如 google.com 也包括 mail.google.com。",
    only: "只提示这些网站",
    onlyHint: "留空就是所有网站。",
    sitesPlaceholder: "example.com, github.com",
    iconsHint: "书签显示网站图标要打开「读取链接标题和图标」。",
    export: "导出书签",
    exportHint: "写成「下载」文件夹里的一个 JSON 文件。",
    exportAction: "导出",
    import: "导入书签",
    importHint: "读浮屿导出的 JSON，或每行一个网址的文本文件；已有的网址跳过。",
    importAction: "选择文件",
    exported: "已导出书签",
    imported: (count) => (count > 0 ? `导入了 ${count} 个书签` : "没有新的书签"),
    failed: "没能完成",
    show: "在文件夹中显示",
    showMac: "在访达中显示",
  },
};

export const en: ClipboardLinksText = {
  chip: "Bookmarks",
  label: "Link bookmarks",
  count: (count) => (count === 1 ? "1 bookmark" : `${count} bookmarks`),
  empty: "No bookmarks yet",
  emptyHint: "After copying a link, press the bookmark button on the island's card, or use ⋯ on a link in the clipboard list.",
  open: (title) => `Open ${title}`,
  remove: "Remove bookmark",
  drag: "Drag to reorder",
  dragHint: "Drag, or press ↑ ↓ to move",
  bookmark: "Bookmark",
  bookmarked: "Bookmarked",
  linkCopied: (summary) => `Link copied · ${summary}`,
  failed: "The bookmark wasn't saved",
  settings: {
    title: "Link bookmarks",
    notice: "Offer to bookmark copied links",
    noticeHint: "When you copy a web address anywhere, the collapsed island shows it; the bookmark button keeps it under Bookmarks on the clipboard page.",
    matching: "Which links",
    matchingOptions: { any: "Any web address", web: "Only http(s)://" },
    blocked: "Never for these sites",
    blockedHint: "Domains, separated by commas, spaces or new lines. Subdomains count too: google.com covers mail.google.com.",
    only: "Only for these sites",
    onlyHint: "Leave empty for every site.",
    sitesPlaceholder: "example.com, github.com",
    iconsHint: "Site icons on bookmarks need “Read link titles and icons”.",
    export: "Export bookmarks",
    exportHint: "Writes a JSON file to your Downloads folder.",
    exportAction: "Export",
    import: "Import bookmarks",
    importHint: "Reads a JSON file exported by Fuyu, or a text file with one address per line. Addresses you already have are skipped.",
    importAction: "Choose file",
    exported: "Bookmarks exported",
    imported: (count) => (count === 0 ? "No new bookmarks" : count === 1 ? "Imported 1 bookmark" : `Imported ${count} bookmarks`),
    failed: "That didn't work",
    show: "Show in folder",
    showMac: "Show in Finder",
  },
};
