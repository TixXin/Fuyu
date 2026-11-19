export type SettingsMessageSourcesText = {
  noticeTitle: string;
  noticeLabel: string;
  noticeLine: string;
  noticeBanner: string;
  noticePanel: string;
  noticeHint: string;
  noticeLineHint: string;
  noticeBannerHint: string;
  noticePanelHint: string;
  sourcesOn: (count: number) => string;
  mailCount: (count: number) => string;
  panelSeconds: string;
  panelSecondsValue: (seconds: number) => string;
  otpCopyLabel: string;
  otpCopyDescription: string;
  mainTitle: string;
  mainHint: string;
  mainHintMac: string;
  othersNote: string;
  summaryHint: string;
  summaryHintMac: string;
  allReceiving: string;
  connecting: (count: number) => string;
  needsAttention: (count: number) => string;
  capability: { full: string; remind: string; count: string; mail: string };
  waitingForAccessMac: string;
  accessTitleMac: string;
  accessBodyMac: string;
  accessActionMac: string;
  howToSeeContent: string;
  moreApps: (count: number) => string;
  fewerApps: (count: number) => string;
  mailNeedsCode: (total: number, stale: number) => string;
  mailEmptyHint: string;
  afterTitle: string;
  autoClearLabel: string;
  autoClearDescription: string;
  autoClearDescriptionMac: string;
  stage: {
    label: string;
    sampleLabel: string;
    sampleQQ: string;
    sampleWeChat: string;
    sampleMail: string;
    replay: string;
    tryOnIsland: string;
    trySent: string;
    captionLine: string;
    captionBanner: string;
    captionPanel: (seconds: number) => string;
    panelTitle: (count: number) => string;
    now: string;
    minuteAgo: string;
    friend: string;
    friendBody: string;
    wechatFriend: string;
    wechatBody: string;
    newMessage: string;
    newReminder: string;
    mailSender: string;
    mailBody: (code: string) => string;
  };
  imOthersTitle: string;
  installedBadge: string;
  imOthersHint: string;
  imOthersHintMac: string;
  imSystemToastHint: string;
};

export const zhCN: SettingsMessageSourcesText = {
  noticeTitle: "新消息提示",
  noticeLabel: "提示方式",
  noticeLine: "一行预览",
  noticeBanner: "横幅",
  noticePanel: "展开面板",
  noticeHint: "横幅在收起的岛下方弹出一张卡片，写发送人、摘要和时间，几秒后收回，鼠标停在上面时不收，点它打开对应的程序；微信读不到内容，卡片只写「有新提醒」。展开面板让岛自己展开到消息页，只列这次到达的消息（含微信），到时间自己收起，在面板里点过就不再自动收起。",
  noticeLineHint: "收起的岛上滚过一行",
  noticeBannerHint: "岛下方弹出一张卡片",
  noticePanelHint: "岛自己展开到消息页",
  sourcesOn: (count) => (count === 0 ? "还没有开启的来源" : `已开 ${count} 个来源`),
  mailCount: (count) => (count === 0 ? "还没有添加邮箱" : `${count} 个邮箱`),
  panelSeconds: "面板停留时间",
  panelSecondsValue: (seconds) => `${seconds} 秒`,
  otpCopyLabel: "识别通知中的验证码",
  otpCopyDescription: "新邮件或通知含有验证码时，在横幅、弹出面板和阅读页显示一键复制按钮",
  mainTitle: "常用",
  mainHint: "QQ 读的是 Windows 通知，需要 QQ 已登录并开启系统通知。微信监听任务栏的闪烁提醒，需要微信保持登录；不打开「显示联系人和消息摘要」时，只知道有新提醒，不知道是谁、说了什么。",
  mainHintMac: "QQ 和微信看的是程序坞图标上的未读数，数字变多时提醒。需要它们开着，并在「系统设置 → 隐私与安全性 → 辅助功能」里允许浮屿。",
  othersNote: "本机装了的排在前面",
  summaryHint: "聊天软件读的是系统通知和任务栏闪烁，消息只留在这次运行的内存里。",
  summaryHintMac: "Mac 上看的是程序坞图标的未读数，所以聊天软件读不到是谁、说了什么；邮箱不受影响。",
  allReceiving: "都在正常接收",
  connecting: (count) => `${count} 个连接中`,
  needsAttention: (count) => `${count} 个要处理`,
  capability: {
    full: "能看到发送人和内容",
    remind: "只提示有新消息",
    count: "只知道未读数变多了",
    mail: "发件人和主题，正文在岛上读",
  },
  waitingForAccessMac: "等辅助功能权限",
  accessTitleMac: "还没有辅助功能权限",
  accessBodyMac: "聊天软件的未读数读不到。在「系统设置 → 隐私与安全性 → 辅助功能」里允许浮屿，开一次所有聊天软件都能用。",
  accessActionMac: "打开系统设置",
  howToSeeContent: "怎么看到内容",
  moreApps: (count) => `还有 ${count} 款没检测到安装`,
  fewerApps: (count) => `收起没检测到的 ${count} 款`,
  mailNeedsCode: (total, stale) => `${total} 个邮箱，${stale} 个要重新授权`,
  mailEmptyHint: "用授权码登录，只同步邮件头，正文点开才读",
  afterTitle: "消息到了之后",
  autoClearLabel: "看过后从岛上去掉",
  autoClearDescription: "切到那个软件、或在岛上点开它之后，去掉在那之前到的消息；之后到的留着",
  autoClearDescriptionMac: "切到那个软件、程序坞上的未读角标消失、或在岛上点开它之后，去掉在那之前到的消息；之后到的留着",
  stage: {
    label: "提示方式演示",
    sampleLabel: "示例",
    sampleQQ: "QQ 消息",
    sampleWeChat: "微信提醒",
    sampleMail: "带验证码的邮件",
    replay: "再演示一次",
    tryOnIsland: "在真岛上试一下",
    trySent: "已发到岛上",
    captionLine: "收起的岛上滚过一行，几秒后恢复",
    captionBanner: "岛下方弹出一张卡片，几秒后收回；鼠标停在上面不收",
    captionPanel: (seconds) => `岛自己展开，只列这次到的消息，${seconds} 秒后收起`,
    panelTitle: (count) => `新消息 · ${count}`,
    now: "刚刚",
    minuteAgo: "1 分钟前",
    friend: "饭搭子",
    friendBody: "奶茶到了，下楼拿",
    wechatFriend: "老己",
    wechatBody: "周报写完了吗",
    newMessage: "有新消息",
    newReminder: "有新提醒",
    mailSender: "账号服务",
    mailBody: (code) => `验证码 ${code}，10 分钟内有效`,
  },
  imOthersTitle: "更多聊天软件",
  installedBadge: "已安装",
  imOthersHint: "读取系统通知中的发送人和摘要，客户端未发系统通知但闪烁任务栏时兜底显示「有新提醒」，只保留在本次运行的内存中。",
  imOthersHintMac: "看程序坞图标上的未读数，数字变多时提醒；需要对应应用开着，并在「系统设置 → 隐私与安全性 → 辅助功能」里允许浮屿。",
  imSystemToastHint: "默认自绘弹窗时只提示「有新提醒」；在软件设置内开启系统通知即可显示发送人和消息内容。",
};

export const en: SettingsMessageSourcesText = {
  noticeTitle: "New messages",
  noticeLabel: "Show as",
  noticeLine: "One line",
  noticeBanner: "Banner",
  noticePanel: "Open panel",
  noticeHint: "A banner drops a card below the collapsed island with the sender, a summary and the time, and slides back after a few seconds unless the pointer rests on it; clicking it opens the app. WeChat gives no message text, so its card only says there is a new reminder. Open panel opens the island on the Messages page with just the new messages (WeChat included) and closes it again in time, unless you click inside.",
  noticeLineHint: "One line scrolls across the collapsed island",
  noticeBannerHint: "A card drops below the island",
  noticePanelHint: "The island opens on Messages by itself",
  sourcesOn: (count) => (count === 0 ? "No sources on yet" : count === 1 ? "1 source on" : `${count} sources on`),
  mailCount: (count) => (count === 0 ? "No mailboxes yet" : count === 1 ? "1 mailbox" : `${count} mailboxes`),
  panelSeconds: "Panel stays for",
  panelSecondsValue: (seconds) => `${seconds} s`,
  otpCopyLabel: "Detect verification codes",
  otpCopyDescription: "Show a one-click copy button on banners, arrival cards and the mail reader when a verification code is found",
  mainTitle: "Everyday",
  mainHint: "QQ is read from Windows notifications, so it must be signed in with system notifications on. WeChat is watched for taskbar flashes and must stay signed in; unless \"Show the contact and message\" is on, it only knows that something came, not who or what.",
  mainHintMac: "QQ and WeChat are watched through the unread count on their Dock icons. They must be running, and Fuyu allowed under System Settings > Privacy & Security > Accessibility.",
  othersNote: "Installed apps come first",
  summaryHint: "Chat apps are read from system notifications and taskbar flashes; messages stay in memory for this run only.",
  summaryHintMac: "On a Mac the unread count on each Dock icon is watched, so chat apps cannot tell who wrote or what; mail is not affected.",
  allReceiving: "All receiving",
  connecting: (count) => `${count} connecting`,
  needsAttention: (count) => `${count} to fix`,
  capability: {
    full: "Shows the sender and message",
    remind: "Only says something new came",
    count: "Only knows the unread count went up",
    mail: "Sender and subject; read the body on the island",
  },
  waitingForAccessMac: "Waiting for Accessibility access",
  accessTitleMac: "Accessibility access is missing",
  accessBodyMac: "Unread counts of chat apps cannot be read. Allow Fuyu under System Settings > Privacy & Security > Accessibility; once covers every chat app.",
  accessActionMac: "Open System Settings",
  howToSeeContent: "How to see the message",
  moreApps: (count) => `${count} more not found on this computer`,
  fewerApps: (count) => `Hide the ${count} not found`,
  mailNeedsCode: (total, stale) => `${total === 1 ? "1 mailbox" : `${total} mailboxes`}, ${stale} to re-authorize`,
  mailEmptyHint: "Signs in with an authorization code; only headers sync, the body loads when you open a message",
  afterTitle: "After a message arrives",
  autoClearLabel: "Remove from the island once seen",
  autoClearDescription: "When that app comes to the front or you open it from the island, messages that arrived before then are removed; later ones stay",
  autoClearDescriptionMac: "When that app comes to the front, its Dock badge clears or you open it from the island, messages that arrived before then are removed; later ones stay",
  stage: {
    label: "Notice style demo",
    sampleLabel: "Sample",
    sampleQQ: "QQ message",
    sampleWeChat: "WeChat reminder",
    sampleMail: "Mail with a code",
    replay: "Play again",
    tryOnIsland: "Try it on the island",
    trySent: "Sent to the island",
    captionLine: "One line scrolls across the collapsed island, then it goes back",
    captionBanner: "A card appears below the island and leaves after a few seconds, unless the pointer rests on it",
    captionPanel: (seconds) => `The island opens with just the new messages and closes after ${seconds} s`,
    panelTitle: (count) => `New · ${count}`,
    now: "now",
    minuteAgo: "1 min ago",
    friend: "Lunch buddy",
    friendBody: "Boba is here, come down",
    wechatFriend: "Sam",
    wechatBody: "Is the weekly report done?",
    newMessage: "New message",
    newReminder: "New reminder",
    mailSender: "Account service",
    mailBody: (code) => `Code ${code}, valid for 10 minutes`,
  },
  imOthersTitle: "More chat apps",
  installedBadge: "Installed",
  imOthersHint: "Reads the sender and preview from system notifications, falls back to a taskbar-flash reminder when an app uses its own popups, and keeps items in memory for this run only.",
  imOthersHintMac: "Watches the unread count on each app's Dock icon and tells you when it goes up; the app must be running and Fuyu allowed under System Settings > Privacy & Security > Accessibility.",
  imSystemToastHint: "Shows 'New reminder' while the app uses its own popups; turn on system notifications in the app's settings to display the sender and message.",
};
