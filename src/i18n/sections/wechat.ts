export type WechatText = {
  desktopOnly: string;
  receive: string;
  pause: string;
  open: string;
  noReminders: string;
  clear: string;
  list: string;
  openItem: (title: string) => string;
  /** Under a reminder that came without a contact and message: why. */
  plainReason: {
    tray: string;
    unreadable: string;
    baseline: string;
    unchanged: string;
    muted: string;
  };
  exposeUi: string;
  exposeUiDescription: string;
  hideTaskbarButton: string;
  hideTaskbarButtonDescription: string;
  status: {
    disabled: string;
    waiting: string;
    listening: string;
    error: string;
  };
};

export const zhCN: WechatText = {
  desktopOnly: "请在 Windows 桌面版中使用微信提醒。",
  receive: "接收微信提醒",
  pause: "暂停微信提醒",
  open: "打开微信",
  noReminders: "暂无提醒",
  clear: "清空微信提醒",
  list: "微信提醒列表",
  openItem: (title) => `打开微信：${title}`,
  plainReason: {
    tray: "微信关在托盘里，读不到会话列表；用最小化代替关闭",
    unreadable: "没读到微信的会话列表",
    baseline: "刚开始读会话列表，这一条还没法比较",
    unchanged: "会话列表里没看出是哪个聊天",
    muted: "只有免打扰的聊天有新消息",
  },
  exposeUi: "显示联系人和消息摘要",
  exposeUiDescription: "把正在运行的微信里控制辅助功能的一个字节从 0 改成 1，微信就像开着读屏软件一样公开界面，提醒卡片能显示联系人和摘要，点卡片进入那个聊天。只改内存，微信重启后自动再改，关掉时改回。这是微信没有公开支持的做法，会多占一些 CPU 和内存，腾讯可能视为异常行为。微信关在托盘里时读不到，最小化可以。",
  hideTaskbarButton: "微信最小化时不占任务栏",
  hideTaskbarButtonDescription: "建议打开。微信关在托盘里时读不到会话列表，最小化才能读。打开后，最小化的微信不显示任务栏按钮，看起来和关进托盘一样；从托盘或提醒卡片打开微信时按钮回来。所以请用最小化代替关闭。",
  status: {
    disabled: "已暂停",
    waiting: "连接中",
    listening: "已连接",
    error: "连接失败，正在重试",
  },
};

export const en: WechatText = {
  desktopOnly: "Use the Windows desktop app for WeChat reminders.",
  receive: "Receive WeChat reminders",
  pause: "Pause WeChat reminders",
  open: "Open WeChat",
  noReminders: "No reminders",
  clear: "Clear WeChat reminders",
  list: "WeChat reminders",
  openItem: (title) => `Open WeChat: ${title}`,
  plainReason: {
    tray: "WeChat is closed to the tray, where its chat list cannot be read; minimize it instead",
    unreadable: "WeChat's chat list could not be read",
    baseline: "The chat list was read for the first time, so there was nothing to compare with",
    unchanged: "The chat list did not show which chat it was",
    muted: "Only muted chats got new messages",
  },
  exposeUi: "Show the contact and message",
  exposeUiDescription: "Sets one accessibility byte inside the running WeChat from 0 to 1, so WeChat exposes its interface as it would to a screen reader: reminder cards then show the contact and message and open that chat. Memory only; done again after WeChat restarts and undone when turned off. WeChat does not support this, it costs WeChat some CPU and memory, and Tencent may treat it as unusual behaviour. Nothing can be read while WeChat is closed to the tray; minimized works.",
  hideTaskbarButton: "Minimized WeChat leaves the taskbar",
  hideTaskbarButtonDescription: "Recommended. WeChat's chat list can be read while it is minimized but not while it is closed to the tray. With this on, a minimized WeChat has no taskbar button, so it looks just like the tray; the button comes back when WeChat is opened from the tray or a reminder card. So minimize WeChat instead of closing it.",
  status: {
    disabled: "Paused",
    waiting: "Connecting",
    listening: "Connected",
    error: "Connection failed, retrying",
  },
};
