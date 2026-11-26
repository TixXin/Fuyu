import { currentLocale } from "./locale.ts";

const en = {
  title: "File search",
  placeholder: "Search file and folder names…",
  clearSearch: "Clear search",
  typeToSearch: "Type part of a file name. Enter opens it, Ctrl+Enter shows it in its folder.",
  typeToSearchMac: "Type part of a file name. Enter opens it, ⌘+Enter shows it in Finder.",
  searching: "Searching…",
  noResults: "No matching files.",
  more: (count: number) => `Showing the first ${count}. Type more to narrow it down.`,
  reveal: "Show in folder",
  revealMac: "Show in Finder",
  failed: "Search failed",
  timeout: "Search took too long. Try a longer name.",
  noEverything: "Fast file search on Windows uses Everything (free, by voidtools).",
  noEverythingHint: "Install it, start it once, then come back here:",
  notRunning: "Everything is installed but not running.",
  startEverything: "Start Everything",
  starting: "Starting Everything…",
  noEs: "Fuyu talks to Everything through its command-line tool es.exe, which is installed separately.",
  noEsHint: "Install it, then search again:",
  lite: "Everything Lite does not work with other apps; install the full version.",
  download: "Open download page",
  copy: "Copy",
  copied: "Copied",
  retry: "Search again",
  unsupported: "File search works on Windows (Everything) and macOS (Spotlight).",
  spotlightScope: "Searching your home folder with Spotlight.",
};

type Text = typeof en;

const zh: Text = {
  title: "文件搜索",
  placeholder: "搜索文件和文件夹名…",
  clearSearch: "清空搜索",
  typeToSearch: "输入文件名的一部分。回车打开，Ctrl+回车打开所在文件夹。",
  typeToSearchMac: "输入文件名的一部分。回车打开，⌘+回车在访达中显示。",
  searching: "正在搜索…",
  noResults: "没有找到匹配的文件。",
  more: (count: number) => `只列出前 ${count} 个，多输几个字可以缩小范围。`,
  reveal: "打开所在文件夹",
  revealMac: "在访达中显示",
  failed: "搜索出错",
  timeout: "搜索太久没有结果，换个长一点的名字试试。",
  noEverything: "Windows 上的快速文件搜索要用 Everything（voidtools 出品，免费）。",
  noEverythingHint: "装好并启动一次后回到这里：",
  notRunning: "Everything 已安装，但没有在运行。",
  startEverything: "启动 Everything",
  starting: "正在启动 Everything…",
  noEs: "浮屿通过 Everything 的命令行工具 es.exe 来搜索，它需要另外安装。",
  noEsHint: "装好后重新搜索：",
  lite: "Everything Lite 版不能给其他程序用，请换成完整版。",
  download: "打开下载页",
  copy: "复制",
  copied: "已复制",
  retry: "重新搜索",
  unsupported: "文件搜索支持 Windows（Everything）和 macOS（Spotlight）。",
  spotlightScope: "用 Spotlight 搜索你的用户目录。",
};

export const text: Text = currentLocale() === "zh-CN" ? zh : en;

export const PAGE_TITLE = { "zh-CN": zh.title, en: en.title };
