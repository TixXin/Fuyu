export type ImSourceText = {
  desktopOnly: (name: string) => string;
  receive: (name: string) => string;
  title: (name: string) => string;
  navLabel: (name: string) => string;
  recent: (name: string) => string;
  list: (name: string) => string;
  open: (name: string) => string;
  refresh: (name: string) => string;
  clear: (name: string) => string;
  allowLabel: (name: string) => string;
  retryLabel: (name: string) => string;
  openNotification: (name: string, title: string) => string;
  flashBody: string;
};

export type MessagesText = {
  title: string;
  sources: string;
  wechat: string;
  mail: string;
  qqMail: string;
  qqNotifications: string;
  wechatReminders: string;
  newReminder: string;
  unreadCount: (count: number) => string;
  newMessage: string;
  newMail: string;
  wechatPreview: string;
  newMailLabel: string;
  sourceLabels: {
    qq: string;
    wechat: string;
    qqMail: string;
    telegram: string;
    discord: string;
    whatsapp: string;
    tim: string;
    feishu: string;
    dingtalk: string;
    wecom: string;
    plugin: string;
  };
  im: ImSourceText;
  collapsedTask: (title: string) => string;
  expand: (label: string) => string;
  openPreview: (text: string, source: string) => string;
  badge: (count: number, wechat: boolean, extraCount?: number) => string;
  label: (text: string) => string;
  qqPreview: (title: string, body: string) => string;
  copyText: string;
  copied: string;
  copyCode: (code: string) => string;
  sampleTitle: string;
  sampleBody: string;
  banner: {
    more: (count: number) => string;
    close: string;
    actions: string;
  };
  arrivals: {
    title: string;
    trackChange: string;
    showAll: string;
    clearAll: string;
    clearAllHint: string;
  };
};

const zhJoin = (prefix: string, name: string, suffix = "") => {
  const lead = prefix && /^[A-Za-z0-9]/.test(name) ? " " : "";
  const trail = suffix && /[A-Za-z0-9]$/.test(name) ? " " : "";
  return `${prefix}${lead}${name}${trail}${suffix}`;
};

export const zhCN: MessagesText = {
  title: "消息",
  sources: "消息来源",
  wechat: "微信",
  mail: "邮箱",
  qqMail: "邮箱",
  qqNotifications: "QQ 通知",
  wechatReminders: "微信提醒",
  newReminder: "有新提醒",
  unreadCount: (count) => `${count} 条未读`,
  newMessage: "收到一条新消息",
  newMail: "收到一封新邮件",
  wechatPreview: "你收到了一条消息",
  newMailLabel: "邮箱有新邮件，查看邮件",
  sourceLabels: {
    qq: "QQ",
    wechat: "微信",
    qqMail: "邮箱",
    telegram: "Telegram",
    discord: "Discord",
    whatsapp: "WhatsApp",
    tim: "TIM",
    feishu: "飞书",
    dingtalk: "钉钉",
    wecom: "企业微信",
    plugin: "插件",
  },
  im: {
    desktopOnly: (name) => zhJoin("请在桌面版中使用", name, "消息。"),
    receive: (name) => zhJoin("接收", name, "消息"),
    title: (name) => zhJoin("", name, "消息"),
    navLabel: (name) => zhJoin("", name, "通知"),
    recent: (name) => zhJoin("", name, "最近通知"),
    list: (name) => zhJoin("最近收到的", name, "通知"),
    open: (name) => zhJoin("打开", name),
    refresh: (name) => zhJoin("刷新", name, "通知状态"),
    clear: (name) => zhJoin("清空岛内", name, "通知"),
    allowLabel: (name) => zhJoin("允许", name, "通知访问"),
    retryLabel: (name) => zhJoin("重试", name, "通知授权"),
    openNotification: (name, title) => `${zhJoin("打开", name)}：${title}`,
    flashBody: "收到任务栏闪烁提醒；在软件设置内开启系统通知后可显示发送人和消息内容。",
  },
  collapsedTask: (title) => `待办：${title}`,
  expand: (label) => `${label}，点击展开`,
  openPreview: (text, source) => `${text}，点击打开${source}`,
  badge: (count, wechat, extraCount = 0) => `QQ ${count} 条通知${wechat ? "，微信有新提醒" : ""}${extraCount > 0 ? `，其他聊天 ${extraCount} 条提醒` : ""}`,
  label: (text) => `消息：${text}`,
  qqPreview: (title, body) => `${title}：${body}`,
  copyText: "复制内容",
  copied: "已复制",
  copyCode: (code) => `复制 ${code}`,
  sampleTitle: "示例消息",
  sampleBody: "新消息会像这样出现在岛上",
  banner: {
    more: (count) => `另有 ${count} 条`,
    close: "关闭通知",
    actions: "通知操作",
  },
  arrivals: {
    title: "新消息",
    trackChange: "切歌",
    showAll: "全部消息",
    clearAll: "清除提醒",
    clearAllHint: "清除岛上的所有提醒，不打开应用；这里列出的邮件会在邮箱里标为已读，微信、QQ 等聊天应用里的消息不变",
  },
};

export const en: MessagesText = {
  title: "Messages",
  sources: "Message sources",
  wechat: "WeChat",
  mail: "Mail",
  qqMail: "Mail",
  qqNotifications: "QQ notifications",
  wechatReminders: "WeChat reminders",
  newReminder: "New reminder",
  unreadCount: (count) => `${count} unread`,
  newMessage: "New message",
  newMail: "New email",
  wechatPreview: "You received a message",
  newMailLabel: "New email, view mail",
  sourceLabels: {
    qq: "QQ",
    wechat: "WeChat",
    qqMail: "Mail",
    telegram: "Telegram",
    discord: "Discord",
    whatsapp: "WhatsApp",
    tim: "TIM",
    feishu: "Feishu",
    dingtalk: "DingTalk",
    wecom: "WeCom",
    plugin: "Plugin",
  },
  im: {
    desktopOnly: (name) => `Use the desktop app for ${name} notifications.`,
    receive: (name) => `Receive ${name} messages`,
    title: (name) => `${name} messages`,
    navLabel: (name) => `${name} notifications`,
    recent: (name) => `Recent ${name} notifications`,
    list: (name) => `Recently received ${name} notifications`,
    open: (name) => `Open ${name}`,
    refresh: (name) => `Refresh ${name} notifications`,
    clear: (name) => `Clear ${name} notifications in the island`,
    allowLabel: (name) => `Allow access to ${name} notifications`,
    retryLabel: (name) => `Retry ${name} notification authorization`,
    openNotification: (name, title) => `Open ${name}: ${title}`,
    flashBody: "Taskbar flash detected; turn on system notifications in the app's settings to show the sender and message.",
  },
  collapsedTask: (title) => `Task: ${title}`,
  expand: (label) => `${label}, click to expand`,
  openPreview: (text, source) => `${text}, click to open ${source}`,
  badge: (count, wechat, extraCount = 0) => `${count} QQ notification${count === 1 ? "" : "s"}${wechat ? ", new WeChat reminder" : ""}${extraCount > 0 ? `, ${extraCount} other chat reminder${extraCount === 1 ? "" : "s"}` : ""}`,
  label: (text) => `Messages: ${text}`,
  qqPreview: (title, body) => `${title}: ${body}`,
  copyText: "Copy message",
  copied: "Copied",
  copyCode: (code) => `Copy ${code}`,
  sampleTitle: "Sample message",
  sampleBody: "New messages will show up on the island like this",
  banner: {
    more: (count) => `${count} more`,
    close: "Dismiss notification",
    actions: "Notification actions",
  },
  arrivals: {
    title: "New messages",
    trackChange: "Track change",
    showAll: "All messages",
    clearAll: "Clear reminders",
    clearAllHint: "Clears every reminder on the island without opening an app; the mails listed here are marked read in the mailbox, chat apps are left as they are",
  },
};
