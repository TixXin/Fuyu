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

export type MessageFeedText = {
  noSubject: string;
  layoutTitle: string;
  layoutHint: string;
  layouts: Record<"focus" | "inbox" | "reader" | "stacks" | "board" | "timeline", { name: string; hint: string }>;
  more: string;
  all: string;
  unread: (count: number) => string;
  readAll: string;
  read: string;
  open: string;
  openIn: (app: string) => string;
  openApp: (app: string) => string;
  copy: string;
  copyCode: string;
  copied: string;
  later: string;
  refresh: string;
  compose: string;
  sourceDetails: (name: string) => string;
  back: string;
  clear: (name: string | null) => string;
  doneTitle: string;
  doneSource: (name: string) => string;
  lastMessage: (when: string, source: string, who: string) => string;
  todayCount: (count: number) => string;
  noSources: string;
  openSettings: string;
  status: Record<"ok" | "off" | "access" | "auth" | "setup" | "error" | "waiting", (name: string) => string>;
  notice: Record<"off" | "access" | "auth" | "setup" | "error", (name: string) => string>;
  noticeHint: Record<"off" | "access" | "auth" | "setup", string>;
  turnOn: string;
  grant: string;
  fixInSettings: string;
  chatReadHint: string;
  buckets: Record<"recent" | "today" | "yesterday" | "earlier", string>;
  progress: (index: number, total: number) => string;
  upNext: string;
  count: (count: number) => string;
  moreInThread: (count: number) => string;
  conversations: (unread: number, conversations: number) => string;
  collapse: string;
  readGroup: string;
  today: string;
  now: string;
  plainHint: string;
  keys: { open: string; copy: string; later: string; read: string };
  filter: string;
  list: string;
  nothingHere: string;
  pick: string;
  hidden: (name: string) => string;
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
  showFullMessage: string;
  showLessMessage: string;
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
  feed: MessageFeedText;
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
  showFullMessage: "展开全文",
  showLessMessage: "收起",
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
  feed: {
    noSubject: "（无主题）",
    layoutTitle: "消息页布局",
    layoutHint: "展开消息页时怎么排列各来源的消息；在消息页右上角的布局按钮里也能换。",
    layouts: {
      focus: { name: "一次一条", hint: "大卡片一条一条处理，带快捷键" },
      inbox: { name: "统一收件箱", hint: "所有来源按时间排成一列" },
      reader: { name: "三栏", hint: "来源、列表、详情并排，适合读邮件" },
      stacks: { name: "按人叠卡", hint: "同一个人、同一个群叠成一摞" },
      board: { name: "来源看板", hint: "每个来源一列，并排看" },
      timeline: { name: "时间轴", hint: "顺着时间往下读，顶上是今天的节奏" },
    },
    more: "更多操作",
    all: "全部",
    unread: (count) => `${count} 条未读`,
    readAll: "全部已读",
    read: "已读",
    open: "打开",
    openIn: (app) => zhJoin("在", app, "中打开"),
    openApp: (app) => zhJoin("打开", app),
    copy: "复制",
    copyCode: "复制验证码",
    copied: "已复制",
    later: "稍后",
    refresh: "刷新",
    compose: "写邮件",
    sourceDetails: (name) => zhJoin("", name, "详情与设置"),
    back: "返回",
    clear: (name) => (name ? zhJoin("清空", name, "记录") : "清空全部记录"),
    doneTitle: "都看完了",
    doneSource: (name) => zhJoin("", name, "都看完了"),
    lastMessage: (when, source, who) => `上一条 ${when} · ${source}「${who}」`,
    todayCount: (count) => `今天一共 ${count} 条`,
    noSources: "还没有打开任何消息来源",
    openSettings: "去设置打开",
    status: {
      ok: (name) => zhJoin("", name, "接收中"),
      off: (name) => zhJoin("", name, "已关闭"),
      access: (name) => zhJoin("", name, "缺权限"),
      auth: (name) => zhJoin("", name, "要重新授权"),
      setup: () => "还没添加邮箱",
      error: (name) => zhJoin("", name, "出错了"),
      waiting: (name) => zhJoin("", name, "等待中"),
    },
    notice: {
      off: (name) => zhJoin("", name, "已关闭"),
      access: (name) => zhJoin("", name, "需要通知权限"),
      auth: () => "邮箱需要重新授权",
      setup: () => "还没添加邮箱",
      error: (name) => zhJoin("", name, "出错了"),
    },
    noticeHint: {
      off: "新消息不会出现在这里",
      access: "系统没让浮屿读取它的通知",
      auth: "授权码过期或被改了",
      setup: "在设置里添加后，新邮件会出现在这里",
    },
    turnOn: "打开",
    grant: "去授权",
    fixInSettings: "去设置",
    chatReadHint: "只在岛上标为已读，聊天软件里不会变成已读",
    buckets: { recent: "刚刚", today: "今天早些", yesterday: "昨天", earlier: "更早" },
    progress: (index, total) => `${index} / ${total}`,
    upNext: "接下来",
    count: (count) => `${count} 条`,
    moreInThread: (count) => `还有 ${count} 条`,
    conversations: (unread, conversations) => `${unread} 条未读 · 来自 ${conversations} 个对话`,
    collapse: "收起",
    readGroup: "这组已读",
    today: "条 · 今天",
    now: "现在",
    plainHint: "只知道有新消息，看不到内容",
    keys: { open: "Enter", copy: "C", later: "S", read: "空格" },
    filter: "按来源筛选",
    list: "消息列表",
    nothingHere: "这里没有消息",
    pick: "选一条消息查看",
    hidden: (name) => zhJoin("隐藏", name),
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
  showFullMessage: "Show more",
  showLessMessage: "Show less",
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
  feed: {
    noSubject: "(No subject)",
    layoutTitle: "Messages page layout",
    layoutHint: "How messages from every source are arranged on the Messages page; you can also switch with the layout button at the top right of the page.",
    layouts: {
      focus: { name: "One at a time", hint: "Work through big cards one by one, with shortcuts" },
      inbox: { name: "Unified inbox", hint: "Every source in one list, newest first" },
      reader: { name: "Three panes", hint: "Sources, list and details side by side; good for mail" },
      stacks: { name: "Stacks", hint: "Each person or group stacked into one pile" },
      board: { name: "Board", hint: "One column per source, side by side" },
      timeline: { name: "Timeline", hint: "Read down through time, today's rhythm on top" },
    },
    more: "More actions",
    all: "All",
    unread: (count) => `${count} unread`,
    readAll: "Mark all read",
    read: "Read",
    open: "Open",
    openIn: (app) => `Open in ${app}`,
    openApp: (app) => `Open ${app}`,
    copy: "Copy",
    copyCode: "Copy code",
    copied: "Copied",
    later: "Later",
    refresh: "Refresh",
    compose: "New email",
    sourceDetails: (name) => `${name} details and settings`,
    back: "Back",
    clear: (name) => (name ? `Clear ${name} history` : "Clear all history"),
    doneTitle: "All caught up",
    doneSource: (name) => `${name}: all caught up`,
    lastMessage: (when, source, who) => `Last one ${when} · ${source} "${who}"`,
    todayCount: (count) => `${count} today`,
    noSources: "No message source is turned on yet",
    openSettings: "Turn on in Settings",
    status: {
      ok: (name) => `${name} receiving`,
      off: (name) => `${name} off`,
      access: (name) => `${name} needs access`,
      auth: (name) => `${name} needs sign-in`,
      setup: () => "No mailbox yet",
      error: (name) => `${name} error`,
      waiting: (name) => `${name} waiting`,
    },
    notice: {
      off: (name) => `${name} is off`,
      access: (name) => `${name} needs notification access`,
      auth: () => "Mail needs to be authorized again",
      setup: () => "No mailbox added yet",
      error: (name) => `${name} ran into an error`,
    },
    noticeHint: {
      off: "New messages won't show up here",
      access: "The system hasn't let Fuyu read its notifications",
      auth: "The authorization code expired or changed",
      setup: "Add one in Settings and new mail shows up here",
    },
    turnOn: "Turn on",
    grant: "Allow",
    fixInSettings: "Settings",
    chatReadHint: "Marked read on the island only; the chat app is unchanged",
    buckets: { recent: "Just now", today: "Earlier today", yesterday: "Yesterday", earlier: "Older" },
    progress: (index, total) => `${index} / ${total}`,
    upNext: "Up next",
    count: (count) => `${count}`,
    moreInThread: (count) => `${count} more`,
    conversations: (unread, conversations) => `${unread} unread · ${conversations} conversation${conversations === 1 ? "" : "s"}`,
    collapse: "Collapse",
    readGroup: "Mark these read",
    today: "today",
    now: "Now",
    plainHint: "Only know there's something new; no content",
    keys: { open: "Enter", copy: "C", later: "S", read: "Space" },
    filter: "Filter by source",
    list: "Messages",
    nothingHere: "No messages here",
    pick: "Pick a message to view",
    hidden: (name) => `Hide ${name}`,
  },
};
