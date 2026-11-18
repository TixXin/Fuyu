export type PluginSensitivePermissionKey =
  | "todos:read"
  | "todos:write"
  | "notes:read"
  | "notes:write"
  | "agent-status:read"
  | "agent-status:write"
  | "island:notify"
  | "secrets"
  | "clipboard:read"
  | "messages:read"
  | "media:read"
  | "media:control"
  | "shelf:read"
  | "shelf:write"
  | "windows"
  | "uri";

export type PluginSensitivePromptText = {
  prompt: (plugin: string, action: string) => string;
  allow: string;
  once: string;
  deny: string;
  action: Record<PluginSensitivePermissionKey, string>;
};

export type PluginViewsText = {
  pageLabel: (title: string, plugin: string) => string;
  waiting: string;
  starting: string;
  stopped: string;
  restart: string;
  empty: string;
  search: string;
  loading: string;
  actions: string;
  submit: string;
  submitted: string;
  webviewNotOnMac: string;
  pagesSettings: { title: string; hint: string; empty: string; show: string; moveUp: string; moveDown: string };
  sensitivePrompt: PluginSensitivePromptText;
};

export const zhCN: PluginViewsText = {
  pageLabel: (title, plugin) => `${title}（${plugin}）`,
  waiting: "等待插件发来内容…",
  starting: "插件正在启动…",
  stopped: "插件已停止",
  restart: "重新启动",
  empty: "这里还没有内容",
  search: "搜索",
  loading: "加载中…",
  actions: "操作",
  submit: "提交",
  submitted: "已提交",
  webviewNotOnMac: "这个页面用插件自己的网页画，Mac 上暂不支持。插件在收起条上的内容照常显示。",
  pagesSettings: {
    title: "岛上页面",
    hint: "插件加到岛上的页面排在内置页面之后，这里的顺序也是它们的数字快捷键顺序。只列出已启用插件的页面。",
    empty: "已启用的插件还没有添加页面。",
    show: "显示",
    moveUp: "上移",
    moveDown: "下移",
  },
  sensitivePrompt: {
    prompt: (plugin, action) => `${plugin} 想${action}`,
    allow: "允许",
    once: "本次",
    deny: "拒绝",
    action: {
      "todos:read": "读取待办",
      "todos:write": "修改待办",
      "notes:read": "读取笔记",
      "notes:write": "修改笔记",
      "agent-status:read": "读取 AI Agent 状态",
      "agent-status:write": "报告 AI Agent 状态",
      "island:notify": "在岛上显示通知",
      secrets: "保存自己的密钥",
      "media:control": "控制媒体播放",
      "clipboard:read": "读取剪贴板历史",
      "messages:read": "读取消息提醒",
      "media:read": "读取正在播放的内容",
      "shelf:read": "读取文件中转列表",
      "shelf:write": "修改文件中转列表",
      windows: "新建自己的窗口",
      uri: "处理网页或其他程序打开的 fuyu:// 链接",
    },
  },
};

export const en: PluginViewsText = {
  pageLabel: (title, plugin) => `${title} (${plugin})`,
  waiting: "Waiting for the plugin…",
  starting: "The plugin is starting…",
  stopped: "The plugin has stopped",
  restart: "Restart",
  empty: "Nothing here yet",
  search: "Search",
  loading: "Loading…",
  actions: "Actions",
  submit: "Submit",
  submitted: "Sent",
  webviewNotOnMac: "This page is the plugin's own web page, which is not supported on a Mac yet. The plugin's items on the collapsed bar still show.",
  pagesSettings: {
    title: "Island pages",
    hint: "Pages plugins add come after the built-in pages; this order is also their number shortcut order. Only plugins that are on are listed.",
    empty: "No plugin that is on has added a page yet.",
    show: "Show",
    moveUp: "Move up",
    moveDown: "Move down",
  },
  sensitivePrompt: {
    prompt: (plugin, action) => `${plugin} wants to ${action}`,
    allow: "Allow",
    once: "Once",
    deny: "Deny",
    action: {
      "todos:read": "read your todos",
      "todos:write": "change your todos",
      "notes:read": "read your note",
      "notes:write": "change your note",
      "agent-status:read": "read AI agent statuses",
      "agent-status:write": "report AI agent statuses",
      "island:notify": "show notifications on the island",
      secrets: "keep its own secrets",
      "media:control": "control media playback",
      "clipboard:read": "read your clipboard history",
      "messages:read": "read your message alerts",
      "media:read": "see what is playing",
      "shelf:read": "read the file shelf",
      "shelf:write": "change the file shelf",
      windows: "open windows of its own",
      uri: "handle a fuyu:// link opened by a web page or another app",
    },
  },
};
