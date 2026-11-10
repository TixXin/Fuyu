import type { TransformBlock, TransformId } from "../../features/clipboard/textTransforms";

/** The clipboard window's actions panel, transforms, editor and record status (C38). */
export type ClipboardActionsText = {
  more: string;
  preview: string;
  spaceKey: string;
  panelLabel: string;
  panelSearch: string;
  panelTitle: string;
  noActions: string;
  groups: Record<"paste" | "entry" | "record", string>;
  paste: string;
  pastePlain: string;
  pasteEnter: string;
  pasteEnterHint: string;
  edit: string;
  transform: string;
  transformTitle: string;
  ai: string;
  aiTitle: string;
  aiTasks: Record<"summarize" | "polish" | "grammar" | "translate", string>;
  aiHint: string;
  aiService: string;
  aiLoading: string;
  aiPasteAgain: string;
  aiOwn: string;
  aiOwnHint: string;
  pasteAs: (format: string) => string;
  pasteTextFile: string;
  pastePath: string;
  pasteFile: string;
  pasteOcr: string;
  pasteQr: string;
  noQr: string;
  favorite: string;
  unfavorite: string;
  note: string;
  notePlaceholder: string;
  saveSnippet: string;
  snippetSaved: string;
  delete: string;
  deleted: (label: string) => string;
  undo: string;
  pause15: string;
  pause60: string;
  pauseUntilResumed: string;
  resume: string;
  ignoreNext: string;
  recording: string;
  paused: string;
  pausedUntil: (minutes: number) => string;
  pausedOpen: string;
  ignoringNext: string;
  resumeNow: string;
  transforms: Record<TransformId, string>;
  blocks: Record<TransformBlock, string>;
  result: string;
  resultNative: string;
  merge: string;
  mergeSeparator: Record<"newline" | "space" | "comma", string>;
  editTitle: string;
  editHint: string;
  pasteOnce: string;
  saveAsNew: string;
  cancel: string;
  closePreview: string;
  kinds: Record<"link" | "color" | "json", string>;
  linkCleaned: string;
  linkOffline: string;
  colorPick: string;
  failed: string;
  /** The transform and AI pages on the island's clipboard page (C43), which copy instead. */
  copy: Pick<ClipboardActionsText, "transform" | "transformTitle" | "ai" | "aiHint" | "aiPasteAgain" | "result" | "resultNative">;
};

export const zhCN: ClipboardActionsText = {
  more: "更多",
  preview: "预览",
  spaceKey: "空格",
  panelLabel: "这一条能做的事",
  panelSearch: "搜动作",
  panelTitle: "动作",
  noActions: "没有匹配的动作",
  groups: { paste: "粘贴", entry: "这一条", record: "记录" },
  paste: "粘贴",
  pastePlain: "粘贴为纯文本",
  pasteEnter: "粘贴并回车",
  pasteEnterHint: "终端里会直接执行",
  edit: "编辑后粘贴",
  transform: "转换后粘贴…",
  transformTitle: "转换后粘贴",
  ai: "AI 改写后粘贴…",
  aiTitle: "AI 改写",
  aiTasks: { summarize: "总结", polish: "润色", grammar: "修正错字和语法", translate: "中英互译" },
  aiHint: "按 Enter 把这条发给快捷翻译设置的服务（用它的 Key 和模型），结果出来后再按 Enter 粘贴。",
  aiService: "用快捷翻译的服务",
  aiLoading: "正在请求…",
  aiPasteAgain: "再按 Enter 粘贴",
  aiOwn: "自己的提示词",
  aiOwnHint: "在 设置 → 剪贴板 → AI 提示词 里添加自己的",
  pasteAs: (format) => `粘贴为 ${format}`,
  pasteTextFile: "粘贴为 .txt 文件",
  pastePath: "粘贴图片路径",
  pasteFile: "粘贴为文件",
  pasteOcr: "粘贴识别出的文字",
  pasteQr: "粘贴二维码内容",
  noQr: "图片里没有找到二维码",
  favorite: "收藏",
  unfavorite: "取消收藏",
  note: "写备注 / 标签",
  notePlaceholder: "备注，#词 是标签；Enter 保存",
  saveSnippet: "存为常用片段",
  snippetSaved: "已存为常用片段",
  delete: "删除",
  deleted: (label) => `已删除「${label}」`,
  undo: "撤销",
  pause15: "暂停记录 15 分钟",
  pause60: "暂停记录 1 小时",
  pauseUntilResumed: "暂停记录，直到恢复",
  resume: "恢复记录",
  ignoreNext: "忽略下一次复制",
  recording: "记录中",
  paused: "已暂停",
  pausedUntil: (minutes) => `已暂停记录 · ${minutes} 分钟后恢复`,
  pausedOpen: "已暂停记录",
  ignoringNext: "下一次复制不记录",
  resumeNow: "现在恢复",
  transforms: {
    oneLine: "合成一行命令",
    trim: "去掉首尾空白",
    joinLines: "去掉换行合成一段",
    upper: "全部大写",
    lower: "全部小写",
    camel: "驼峰 camelCase",
    snake: "下划线 snake_case",
    jsonPretty: "JSON 格式化",
    jsonMinify: "JSON 压缩",
    urlEncode: "URL 编码",
    urlDecode: "URL 解码",
    stripTracking: "去掉链接追踪参数",
    halfWidth: "全角 → 半角",
    simplified: "繁体 → 简体",
    traditional: "简体 → 繁体",
    markdown: "HTML → Markdown",
    sortLines: "按行排序",
    dedupeLines: "去掉重复的行",
  },
  blocks: { notJson: "不是 JSON", noLink: "没有链接", noHtml: "没有格式", noChange: "不会改变" },
  result: "粘贴的会是",
  resultNative: "粘贴时由 Windows 转换",
  merge: "合并粘贴",
  mergeSeparator: { newline: "换行分隔", space: "空格分隔", comma: "逗号分隔" },
  editTitle: "编辑后粘贴",
  editHint: "原记录不变",
  pasteOnce: "只粘贴这次",
  saveAsNew: "另存为新记录",
  cancel: "取消",
  closePreview: "关闭",
  kinds: { link: "链接", color: "颜色", json: "JSON" },
  linkCleaned: "去掉追踪参数后",
  linkOffline: "标题和图标要联网读，在 设置 → 剪贴板 里打开",
  colorPick: "点一种写法直接粘贴",
  failed: "没做成，再试一次",
  copy: {
    transform: "转换后复制…",
    transformTitle: "转换后复制",
    ai: "AI 改写后复制…",
    aiHint: "按 Enter 把这条发给快捷翻译设置的服务（用它的 Key 和模型），结果出来后再按 Enter 复制。",
    aiPasteAgain: "再按 Enter 复制",
    result: "复制的会是",
    resultNative: "复制时由 Windows 转换",
  },
};

export const en: ClipboardActionsText = {
  more: "More",
  preview: "Preview",
  spaceKey: "Space",
  panelLabel: "What you can do with this entry",
  panelSearch: "Search actions",
  panelTitle: "Actions",
  noActions: "No matching actions",
  groups: { paste: "Paste", entry: "This entry", record: "Recording" },
  paste: "Paste",
  pastePlain: "Paste as plain text",
  pasteEnter: "Paste and press Enter",
  pasteEnterHint: "runs it in a terminal",
  edit: "Edit, then paste",
  transform: "Paste transformed…",
  transformTitle: "Paste transformed",
  ai: "Rewrite with AI, then paste…",
  aiTitle: "Rewrite with AI",
  aiTasks: { summarize: "Summarize", polish: "Polish", grammar: "Fix spelling and grammar", translate: "Chinese ⇄ English" },
  aiHint: "Enter sends this entry to the service set up for quick translation (its key and model); Enter again pastes the answer.",
  aiService: "Uses the quick translation's service",
  aiLoading: "Asking…",
  aiPasteAgain: "Enter again pastes",
  aiOwn: "Your prompts",
  aiOwnHint: "Add your own in Settings → Clipboard → AI prompts",
  pasteAs: (format) => `Paste as ${format}`,
  pasteTextFile: "Paste as a .txt file",
  pastePath: "Paste the image's path",
  pasteFile: "Paste as a file",
  pasteOcr: "Paste the text in the image",
  pasteQr: "Paste the QR code's content",
  noQr: "No QR code found in the image",
  favorite: "Star",
  unfavorite: "Unstar",
  note: "Note / tags",
  notePlaceholder: "A note; #word is a tag. Enter saves",
  saveSnippet: "Save as a snippet",
  snippetSaved: "Saved as a snippet",
  delete: "Delete",
  deleted: (label) => `Deleted “${label}”`,
  undo: "Undo",
  pause15: "Pause recording for 15 minutes",
  pause60: "Pause recording for 1 hour",
  pauseUntilResumed: "Pause recording until resumed",
  resume: "Resume recording",
  ignoreNext: "Skip the next copy",
  recording: "Recording",
  paused: "Paused",
  pausedUntil: (minutes) => `Recording paused · resumes in ${minutes} min`,
  pausedOpen: "Recording paused",
  ignoringNext: "The next copy is not recorded",
  resumeNow: "Resume now",
  transforms: {
    oneLine: "Join a command into one line",
    trim: "Trim blank space",
    joinLines: "Join lines into one",
    upper: "UPPER CASE",
    lower: "lower case",
    camel: "camelCase",
    snake: "snake_case",
    jsonPretty: "Format JSON",
    jsonMinify: "Minify JSON",
    urlEncode: "URL-encode",
    urlDecode: "URL-decode",
    stripTracking: "Remove link tracking",
    halfWidth: "Full-width → half-width",
    simplified: "Traditional → Simplified Chinese",
    traditional: "Simplified → Traditional Chinese",
    markdown: "HTML → Markdown",
    sortLines: "Sort lines",
    dedupeLines: "Remove duplicate lines",
  },
  blocks: { notJson: "not JSON", noLink: "no link", noHtml: "no formatting", noChange: "no change" },
  result: "This will paste",
  resultNative: "Windows converts it on paste",
  merge: "paste merged",
  mergeSeparator: { newline: "one per line", space: "with spaces", comma: "with commas" },
  editTitle: "Edit, then paste",
  editHint: "The entry stays as it was",
  pasteOnce: "Paste this once",
  saveAsNew: "Save as a new entry",
  cancel: "Cancel",
  closePreview: "Close",
  kinds: { link: "Link", color: "Colour", json: "JSON" },
  linkCleaned: "Without tracking",
  linkOffline: "Titles and icons need the network; turn them on in Settings → Clipboard",
  colorPick: "Click a form to paste it",
  failed: "That did not work; try again",
  copy: {
    transform: "Copy transformed…",
    transformTitle: "Copy transformed",
    ai: "Rewrite with AI, then copy…",
    aiHint: "Enter sends this entry to the service set up for quick translation (its key and model); Enter again copies the answer.",
    aiPasteAgain: "Enter again copies",
    result: "This will copy",
    resultNative: "Windows converts it on copy",
  },
};
