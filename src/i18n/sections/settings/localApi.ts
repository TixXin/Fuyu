export type SettingsLocalApiText = {
  title: string;
  hint: string;
  allowWrite: string;
  allowWriteHint: string;
  allowNotify: string;
  allowNotifyHint: string;
  address: string;
  configFile: string;
  token: string;
  tokenHint: string;
  copy: string;
  copied: string;
  resetToken: string;
  resetTokenConfirm: string;
  resetTokenHint: string;
  notRunning: string;
  accessTitle: string;
  accessHint: string;
  todos: string;
  agents: string;
  clipboard: string;
  notices: string;
  canNotify: string;
  needsNotify: string;
  canReadWrite: string;
  canRead: string;
  canReport: string;
  needsWrite: string;
  featureOff: string;
  clipboardGrant: string;
  openPage: string;
  tryTitle: string;
  tryHint: string;
  tryNotifyHint: string;
  sendersTitle: string;
  sendersHint: string;
  senderOn: string;
  senderMuted: string;
  docs: string;
};

export const zhCN: SettingsLocalApiText = {
  title: "本机接口",
  hint: "让脚本和其他程序经 HTTP 读写待办和每日笔记、上报 AI Agent 状态、在岛上弹消息。只接受本机请求，要带访问令牌。在插件页关掉本机接口后地址就不再监听。",
  allowWrite: "允许修改待办、笔记和 Agent 状态",
  allowWriteHint: "关闭时只能读取，写请求回 403。",
  allowNotify: "允许弹消息",
  allowNotifyHint: "打开后脚本和其他程序能在岛上弹一条消息。和「允许修改」分开，关闭时回 403。",
  address: "地址",
  configFile: "配置文件",
  token: "访问令牌",
  tokenHint: "令牌不在这里显示，复制后粘贴到脚本里。",
  copy: "复制",
  copied: "已复制",
  resetToken: "重新生成令牌",
  resetTokenConfirm: "确认换新",
  resetTokenHint: "换一个新令牌，用旧令牌的脚本立即失效。",
  notRunning: "没有在运行",
  accessTitle: "权限",
  accessHint: "只开放这里列出的几样。邮件、聊天消息、凭据和截图不对本机接口开放。",
  todos: "待办和每日笔记",
  agents: "AI Agent 状态灯",
  clipboard: "剪贴板历史",
  notices: "弹消息",
  canNotify: "可以弹消息",
  needsNotify: "要先打开「允许弹消息」",
  canReadWrite: "可以读取和修改",
  canRead: "只能读取",
  canReport: "可以上报状态",
  needsWrite: "要先打开「允许修改」才能上报",
  featureOff: "这个功能关着，请求回 503",
  clipboardGrant: "只读，另有开关：在剪贴板设置里打开「允许本地接口读取历史」",
  openPage: "去设置",
  tryTitle: "试一下",
  tryHint: "在终端里运行，会返回浮屿的版本号。令牌从配置文件里读，不用写进脚本。",
  tryNotifyHint: "在终端里运行，岛上会弹出一条消息。令牌从配置文件里读，不用写进脚本。",
  sendersTitle: "消息来源",
  sendersHint: "弹过消息的来源都列在这里。关掉的来源照常回 200，只是不弹出。每个来源每分钟最多 10 条，同时最多 16 个来源。",
  senderOn: "照常弹出",
  senderMuted: "已静音，发来的消息不弹出",
  docs: "全部接口说明",
};

export const en: SettingsLocalApiText = {
  title: "Local API",
  hint: "Lets scripts and other programs read and change todos and the daily note, report AI agent status and pop messages on the island over HTTP. Only accepts requests from this computer, with an access token. Switching the local API off on the plugins page stops it listening.",
  allowWrite: "Allow changes to todos, notes and agent status",
  allowWriteHint: "When off, it can only read; writes answer 403.",
  allowNotify: "Allow messages",
  allowNotifyHint: "Lets scripts and other programs pop a message on the island. Separate from “Allow changes”; when off, it answers 403.",
  address: "Address",
  configFile: "Config file",
  token: "Access token",
  tokenHint: "The token is not shown here; copy it and paste it into your script.",
  copy: "Copy",
  copied: "Copied",
  resetToken: "Regenerate token",
  resetTokenConfirm: "Confirm regenerate",
  resetTokenHint: "Switches to a new token; scripts using the old one stop working at once.",
  notRunning: "Not running",
  accessTitle: "Access",
  accessHint: "Only what is listed here is open. Mail, chat messages, credentials and screenshots are not available through the local API.",
  todos: "Todos and the daily note",
  agents: "AI agent status light",
  clipboard: "Clipboard history",
  notices: "Messages",
  canNotify: "Can pop messages",
  needsNotify: "Turn on “Allow messages” first",
  canReadWrite: "Can read and change",
  canRead: "Read only",
  canReport: "Can report status",
  needsWrite: "Turn on “Allow changes” to report status",
  featureOff: "This feature is off; requests answer 503",
  clipboardGrant: "Read only, with its own switch: turn on “Let the local API read the history” in the clipboard settings",
  openPage: "Open settings",
  tryTitle: "Try it",
  tryHint: "Run it in a terminal; it returns Fuyu's version. The token is read from the config file, so it never goes into your script.",
  tryNotifyHint: "Run it in a terminal; a message pops up on the island. The token is read from the config file, so it never goes into your script.",
  sendersTitle: "Message sources",
  sendersHint: "Every source that has sent a message is listed here. A source that is off still gets 200, its messages just do not pop up. At most 10 messages a minute per source, and 16 sources at a time.",
  senderOn: "Pops up as usual",
  senderMuted: "Muted; its messages do not pop up",
  docs: "All routes",
};
