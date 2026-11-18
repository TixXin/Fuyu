type Service = "feishu" | "dingtalk" | "wecom" | "icloud" | "google" | "outlook" | "other";
type CountdownScope = "all" | "meetingsOnly";
type CountdownFormat = "titleMinutes" | "timeTitle" | "compact";
type CalendarHoldMinutes = 0 | 5 | 15 | -1;
type CalendarBannerMinutes = 0 | 1 | 3 | 5;
type WeekStartsOn = "auto" | "monday" | "sunday";

export type SettingsCalendarText = {
  island: string;
  remind: string;
  remindHint: string;
  remindOption: (minutes: number) => string;
  countdownScope: string;
  countdownScopeHint: string;
  countdownScopes: Record<CountdownScope, string>;
  countdownFormat: string;
  countdownFormatHint: string;
  countdownFormats: Record<CountdownFormat, string>;
  showTitle: string;
  showTitleHint: string;
  holdMinutes: string;
  holdMinutesHint: string;
  holdOption: (minutes: CalendarHoldMinutes) => string;
  alertsGroup: string;
  bannerEnabled: string;
  bannerEnabledHint: string;
  bannerMinutes: string;
  bannerOption: (minutes: CalendarBannerMinutes) => string;
  pauseMediaOnJoin: string;
  pauseMediaOnJoinHint: string;
  customDomain: string;
  customDomainHint: string;
  customDomainPlaceholder: string;
  customDomainInvalid: string;
  panelGroup: string;
  agendaRange: string;
  agendaRangeHint: string;
  rangeTwoDays: string;
  rangeSevenDays: string;
  hideDeclined: string;
  hideDeclinedHint: string;
  ignoreFreeInCountdown: string;
  ignoreFreeInCountdownHint: string;
  foldAllDay: string;
  foldAllDayHint: string;
  showWeekNumbers: string;
  showWeekNumbersHint: string;
  weekStartsOn: string;
  weekStartsOnOptions: Record<WeekStartsOn, string>;
  includeTimedTodos: string;
  includeTimedTodosHint: string;
  sources: string;
  refreshNow: string;
  refreshing: string;
  refreshed: string;
  noSources: string;
  icsFrom: (host: string) => string;
  remove: (name: string) => string;
  subCalendarsCount: (count: number) => string;
  subCalendarShow: (name: string) => string;
  subCalendarColor: (name: string) => string;
  subCalendarCountdownOn: string;
  subCalendarCountdownOff: string;
  subCalendarCountdownToggle: (name: string) => string;
  addHolidays: string;
  holidaysAdded: string;
  holidaysName: string;
  add: string;
  cancelAdd: string;
  service: string;
  services: Record<Service, string>;
  steps: Record<Service, string[]>;
  name: string;
  server: string;
  username: string;
  password: string;
  link: string;
  addressOrLink: string;
  addressOrLinkPlaceholder: string;
  addButton: string;
  adding: string;
};

export const zhCN: SettingsCalendarText = {
  island: "小岛倒计时显示",
  remind: "会前倒计时",
  remindHint: "会议开始前这么久，收起的小岛显示会前倒计时，有会议链接时旁边带「加入」按钮。",
  remindOption: (minutes) => (minutes === 0 ? "不显示" : `${minutes} 分钟`),
  countdownScope: "倒计时范围",
  countdownScopeHint: "只在关注视频会议时，可以把没有会议链接的普通日程排除在收起条倒计时外。",
  countdownScopes: { all: "全部非全天日程", meetingsOnly: "仅含视频会议链接" },
  countdownFormat: "收起条显示格式",
  countdownFormatHint: "选择收起条展示会议时间与标题的详略方式。",
  countdownFormats: {
    titleMinutes: "标题 · 10 分钟后",
    timeTitle: "14:00 标题 · 10m",
    compact: "紧凑（仅图标与时间）",
  },
  showTitle: "显示会议标题",
  showTitleHint: "关掉后收起条与横幅提醒只写「会议」，共享屏幕时不会露出会议内容。",
  holdMinutes: "开始后保留时长",
  holdMinutesHint: "会议开始后收起条继续保留的时长；选直至会议结束时会动态显示剩余分钟数。",
  holdOption: (minutes) => {
    if (minutes === 0) return "开始即隐藏";
    if (minutes === -1) return "直至会议结束（显示剩余分钟）";
    return `开始后 ${minutes} 分钟`;
  },
  alertsGroup: "会前强提醒与入会动作",
  bannerEnabled: "会前弹出岛屿强提醒横幅",
  bannerEnabledHint: "临近开会时在岛屿弹出一次提醒横幅，有会议链接时附带「立即加入」按钮。",
  bannerMinutes: "强提醒提前量",
  bannerOption: (minutes) => (minutes === 0 ? "准点" : `会前 ${minutes} 分钟`),
  pauseMediaOnJoin: "点击加入会议时自动暂停媒体",
  pauseMediaOnJoinHint: "点「加入」打开会议链接前，若当前正在播放音乐或视频则自动暂停。",
  customDomain: "自定义视频会议域名",
  customDomainHint: "填写企业私有视频会议域名后，日程地点里的 https://<域名>/… 链接也会识别为会议链接。",
  customDomainPlaceholder: "vc.corp.example.com",
  customDomainInvalid: "请输入有效的域名（如 vc.corp.example.com）",
  panelGroup: "日历面板与过滤规则",
  agendaRange: "默认日程视图",
  agendaRangeHint: "打开日历页时默认展示的议程跨度，面板右上角也可以随时切换。",
  rangeTwoDays: "近两日",
  rangeSevenDays: "未来 7 天",
  hideDeclined: "隐藏已拒绝的日程",
  hideDeclinedHint: "不显示你已在日历邀请中选择「拒绝」的会议。",
  ignoreFreeInCountdown: "空闲日程不参与倒计时",
  ignoreFreeInCountdownHint: "标为「空闲 / 透明」的提醒日程仍显示在面板里，但不触发收起条倒计时和强提醒。",
  foldAllDay: "在列表中折叠全天日程",
  foldAllDayHint: "同一天有多条全天日程时默认折叠其余项，点击可展开。",
  showWeekNumbers: "月历显示周数",
  showWeekNumbersHint: "在月历每行左侧显示 ISO 周数。",
  weekStartsOn: "每周起始日",
  weekStartsOnOptions: { auto: "默认", monday: "周一", sunday: "周日" },
  includeTimedTodos: "以时间开头的待办并入日程",
  includeTimedTodosHint: "今天未完成的待办若以时间开头（如「15:00 周会」「9:30-10:00 站会」），自动排入日程并参与会前倒计时。",
  sources: "已添加的日历",
  refreshNow: "立即刷新",
  refreshing: "刷新中…",
  refreshed: "已刷新",
  noSources: "还没有日历。可以先订阅中国节假日，不用账号；工作日历在下面添加。",
  icsFrom: (host) => `订阅 · ${host}`,
  remove: (name) => `删除日历「${name}」`,
  subCalendarsCount: (count) => `${count} 个子日历`,
  subCalendarShow: (name) => `切换显示子日历「${name}」`,
  subCalendarColor: (name) => `切换子日历「${name}」的颜色`,
  subCalendarCountdownOn: "参与倒计时",
  subCalendarCountdownOff: "仅面板显示",
  subCalendarCountdownToggle: (name) => `切换子日历「${name}」是否参与会前倒计时`,
  addHolidays: "订阅中国节假日",
  holidaysAdded: "已订阅节假日",
  holidaysName: "中国节假日",
  add: "添加日历",
  cancelAdd: "取消",
  service: "用的是",
  services: { feishu: "飞书", dingtalk: "钉钉", wecom: "企业微信", icloud: "iCloud", google: "Google 日历", outlook: "Outlook", other: "其他" },
  steps: {
    feishu: ["打开飞书电脑版 → 日历 → 右上角设置。", "找到「CalDAV 同步」，点生成账号和密码。", "把账号和密码复制到下面。"],
    dingtalk: ["打开钉钉（6.0.8 或更新）→ 日历 → 设置。", "打开「CalDAV 同步」，会显示账号和密码。", "把账号和密码复制到下面。"],
    wecom: ["打开企业微信电脑版 → 日程 → 设置。", "选「同步至其他日历」→ CalDAV，会显示服务器、账号和密码。", "把三项复制到下面。"],
    icloud: ["在 account.apple.com 登录 → 登录与安全 → App 专用密码，新建一个。", "账号填 Apple ID 邮箱，密码填刚生成的 App 专用密码。"],
    google: ["在电脑浏览器打开 Google 日历 → 设置 → 左侧选要显示的日历。", "在「集成日历」里复制「iCal 格式的私密地址」，粘贴到下面。"],
    outlook: ["在 outlook.com 打开设置 → 日历 → 共享日历 → 发布日历。", "选日历和「可以查看所有详细信息」，发布后复制 ICS 链接，粘贴到下面。"],
    other: ["粘贴日历服务器地址（CalDAV）或 .ics 订阅链接。", "是服务器地址时，再填账号和密码。"],
  },
  name: "名称（可不填）",
  server: "服务器地址",
  username: "账号",
  password: "密码",
  link: "订阅链接",
  addressOrLink: "地址或链接",
  addressOrLinkPlaceholder: "https://… 或 webcal://…",
  addButton: "读取并添加",
  adding: "正在读取…",
};

export const en: SettingsCalendarText = {
  island: "Collapsed countdown",
  remind: "Countdown before a meeting",
  remindHint: "This long before a meeting starts, the collapsed island counts down, with a Join button when it has a meeting link.",
  remindOption: (minutes) => (minutes === 0 ? "Off" : `${minutes} min`),
  countdownScope: "Countdown scope",
  countdownScopeHint: "Count down every timed event, or only events that include a video meeting link.",
  countdownScopes: { all: "All timed events", meetingsOnly: "Video meetings only" },
  countdownFormat: "Collapsed bar format",
  countdownFormatHint: "Choose how the start time, title and remaining minutes appear on the bar.",
  countdownFormats: {
    titleMinutes: "Title · in 10 min",
    timeTitle: "14:00 Title · 10m",
    compact: "Compact (icon & time)",
  },
  showTitle: "Show the meeting's title",
  showTitleHint: "Off shows only \"Meeting\" on the bar and banner, so a shared screen does not reveal what the meeting is about.",
  holdMinutes: "Keep after start",
  holdMinutesHint: "How long the countdown stays once the meeting starts, or keep until the meeting ends.",
  holdOption: (minutes) => {
    if (minutes === 0) return "Hide at start";
    if (minutes === -1) return "Until meeting ends (time left)";
    return `${minutes} min after start`;
  },
  alertsGroup: "Strong reminder & joining",
  bannerEnabled: "Pop up an island reminder banner",
  bannerEnabledHint: "Show a one-time banner on the island right before a meeting, with a Join now button when a link is available.",
  bannerMinutes: "Banner lead time",
  bannerOption: (minutes) => (minutes === 0 ? "At start" : `${minutes} min before`),
  pauseMediaOnJoin: "Pause media when joining",
  pauseMediaOnJoinHint: "Pause active music or video playback automatically right before opening a meeting link.",
  customDomain: "Custom meeting domain",
  customDomainHint: "Recognize https://<domain>/… links in event locations for self-hosted video conferencing.",
  customDomainPlaceholder: "vc.corp.example.com",
  customDomainInvalid: "Enter a valid domain such as vc.corp.example.com",
  panelGroup: "Calendar panel & filters",
  agendaRange: "Default agenda view",
  agendaRangeHint: "How many days open by default in the calendar panel; also switchable in the panel header.",
  rangeTwoDays: "2 days",
  rangeSevenDays: "7 days",
  hideDeclined: "Hide declined events",
  hideDeclinedHint: "Hide invitations you have declined.",
  ignoreFreeInCountdown: "Skip free events in countdown",
  ignoreFreeInCountdownHint: "Keep free / transparent events in the list without triggering countdowns or banners.",
  foldAllDay: "Fold extra all-day events",
  foldAllDayHint: "Collapse additional all-day events when a day has more than one.",
  showWeekNumbers: "Show week numbers",
  showWeekNumbersHint: "Show ISO week numbers alongside the monthly grid.",
  weekStartsOn: "Week starts on",
  weekStartsOnOptions: { auto: "Auto", monday: "Mon", sunday: "Sun" },
  includeTimedTodos: "Include timed todos in schedule",
  includeTimedTodosHint: "Treat incomplete todos starting with a time (\"15:00 Weekly sync\", \"9:30-10:00 Standup\") as today's events.",
  sources: "Your calendars",
  refreshNow: "Refresh now",
  refreshing: "Refreshing…",
  refreshed: "Refreshed",
  noSources: "No calendar yet. Subscribe to China's holidays without an account, or add a work calendar below.",
  icsFrom: (host) => `Subscription · ${host}`,
  remove: (name) => `Delete the calendar "${name}"`,
  subCalendarsCount: (count) => `${count} sub-calendars`,
  subCalendarShow: (name) => `Toggle visibility of "${name}"`,
  subCalendarColor: (name) => `Cycle color of "${name}"`,
  subCalendarCountdownOn: "In countdown",
  subCalendarCountdownOff: "Panel only",
  subCalendarCountdownToggle: (name) => `Toggle countdown participation for "${name}"`,
  addHolidays: "Subscribe to China's holidays",
  holidaysAdded: "Holidays subscribed",
  holidaysName: "China holidays",
  add: "Add a calendar",
  cancelAdd: "Cancel",
  service: "Service",
  services: { feishu: "Feishu / Lark", dingtalk: "DingTalk", wecom: "WeCom", icloud: "iCloud", google: "Google Calendar", outlook: "Outlook", other: "Other" },
  steps: {
    feishu: ["Open Feishu on your computer → Calendar → Settings at the top right.", "Find \"CalDAV sync\" and generate an account and password.", "Copy them below."],
    dingtalk: ["Open DingTalk (6.0.8 or later) → Calendar → Settings.", "Turn on \"CalDAV sync\"; it shows an account and password.", "Copy them below."],
    wecom: ["Open WeCom on your computer → Schedule → Settings.", "Choose \"Sync to other calendars\" → CalDAV; it shows a server, account and password.", "Copy all three below."],
    icloud: ["At account.apple.com → Sign-In and Security → App-Specific Passwords, create one.", "The account is your Apple ID email; the password is the app-specific one."],
    google: ["Open Google Calendar in a browser → Settings → pick the calendar on the left.", "Under \"Integrate calendar\", copy \"Secret address in iCal format\" and paste it below."],
    outlook: ["At outlook.com open Settings → Calendar → Shared calendars → Publish a calendar.", "Pick the calendar and \"Can view all details\", publish, then copy the ICS link below."],
    other: ["Paste a calendar server address (CalDAV) or an .ics subscription link.", "For a server, also fill in the account and password."],
  },
  name: "Name (optional)",
  server: "Server",
  username: "Account",
  password: "Password",
  link: "Subscription link",
  addressOrLink: "Address or link",
  addressOrLinkPlaceholder: "https://… or webcal://…",
  addButton: "Read and add",
  adding: "Reading…",
};
