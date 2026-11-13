export type SettingsCategoriesText = {
  label: string;
  search: {
    placeholder: string;
    clear: string;
    empty: string;
  };
  expand: (group: string) => string;
  collapse: (group: string) => string;
  keywords: Record<
    | "overview" | "general" | "musicLyrics" | "musicLyricsStyle" | "clipboardHistory" | "clipboardSnippets" | "clipboardData" | "screenshotRecord" | "behavior" | "behaviorTuck" | "behaviorAlerts" | "shortcutsIsland" | "appearance" | "theme" | "themeMarket" | "shortcuts" | "todos" | "calendar" | "music" | "translation" | "clipboard"
    | "shelf" | "screenshot" | "messages" | "agents" | "agentSessions" | "agentRemote" | "agentAlerts" | "sounds" | "agentApprovals" | "agentConnect"
    | "plugins" | "market" | "about",
    string
  >;
  entries: { behavior: string; appearance: string; shortcuts: string; music: string; clipboard: string; screenshot: string; agents: string };
  tabs: Record<"music" | "clipboard" | "screenshot" | "musicLyrics" | "musicLyricsStyle" | "clipboardHistory" | "clipboardSnippets" | "clipboardData" | "screenshotRecord" | "behavior" | "behaviorTuck" | "behaviorAlerts" | "shortcuts" | "shortcutsIsland" | "theme" | "appearance" | "themeMarket" | "agents" | "agentSessions" | "agentAlerts" | "sounds" | "agentApprovals" | "agentConnect" | "agentRemote", string>;
  groups: {
    basics: string;
    features: string;
    agents: string;
    extensions: string;
  };
  overview: string;
  general: string;
  behavior: string;
  behaviorTuck: string;
  behaviorAlerts: string;
  shortcutsIsland: string;
  musicLyrics: string;
  musicLyricsStyle: string;
  clipboardHistory: string;
  clipboardSnippets: string;
  clipboardData: string;
  screenshotRecord: string;
  appearance: string;
  theme: string;
  themeMarket: string;
  shortcuts: string;
  messages: string;
  mail: string;
  todos: string;
  music: string;
  clipboard: string;
  translation: string;
  shelf: string;
  screenshot: string;
  calendar: string;
  agents: string;
  agentSessions: string;
  agentRemote: string;
  agentAlerts: string;
  sounds: string;
  agentApprovals: string;
  agentConnect: string;
  plugins: string;
  market: string;
  about: string;
};

export const zhCN: SettingsCategoriesText = {
  label: "设置分类",
  search: {
    placeholder: "搜索设置",
    clear: "清除搜索",
    empty: "没有匹配的设置",
  },
  expand: (group) => `展开「${group}」`,
  collapse: (group) => `折叠「${group}」`,
  keywords: {
    overview: "概览 开始 新手 入门 常用 功能 开启 关闭 启用",
    general: "开机 自启 登录 语言 位置 显示器 屏幕 数据 文件夹 备份 恢复",
    behavior: "展开 悬停 收起 动画 切换页面",
    behaviorTuck: "贴边 隐藏 露出 最小化 托盘 菜单栏 全屏 游戏 勿扰",
    behaviorAlerts: "系统提示 音量 亮度 耳机 蓝牙 电量 电源 充电 摄像头 麦克风 隐私",
    musicLyrics: "歌词 来源 文件夹 LRC 在线 酷狗 网易云 提前 推后",
    musicLyricsStyle: "歌词 样式 逐字 高亮 发光 颜色 卡拉OK",
    clipboardHistory: "记录 图片 文件 密码 密钥 排除 条数 清理 OCR",
    clipboardSnippets: "常用语 短语 提示词 AI",
    clipboardData: "导入 导出 备份 迁移",
    screenshotRecord: "录屏 录制 GIF MP4 帧率 画质 声音 麦克风",
    shortcutsIsland: "岛上 按键 翻页 页面切换 审批 Esc 拖动",
    appearance: "尺寸 大小 缩放 面板高度 显示内容 收起条 项目 排序 预览",
    theme: "颜色 背景 透明 不透明度 液态玻璃 字体 像素 圆角 预设 样式 导入 导出 亮点",
    themeMarket: "主题 皮肤 配色 下载 应用 分享",
    shortcuts: "按键 组合键 热键 全局",
    todos: "任务 笔记 归档 保存路径 导出 Markdown",
    calendar: "日程 会议 CalDAV ICS 订阅 节假日",
    music: "歌词 媒体 播放 波形 酷狗 网易云",
    translation: "翻译服务 模型 密钥 API 语言",
    clipboard: "复制 粘贴 历史 图片",
    shelf: "文件 拖放 拖拽 清理",
    screenshot: "截屏 截图 快捷键 选区 放大镜 取色 全屏",
    messages: "QQ 微信 邮箱 邮件 通知 IMAP 授权码",
    agents: "Claude Code Codex 会话标题 状态灯 收起条",
    agentSessions: "会话 卡片 用量 隐藏会话 筛选",
    agentRemote: "SSH 远程 服务器 主机 其他电脑",
    agentAlerts: "弹出 提醒 通知 回复状态标记",
    sounds: "音效 声音包 提示音",
    agentApprovals: "批准 允许 拒绝 权限 提问 回答",
    agentConnect: "钩子 hook 安装 修复",
    plugins: "扩展 已安装 插件目录 开发者 更新 岛屿页面",
    market: "扩展 插件 下载 安装 搜索",
    about: "版本 更新 检查更新 测试版 通道 重置 退出 反馈 Star",
  },
  entries: { behavior: "行为", appearance: "外观", shortcuts: "快捷键", music: "音乐", clipboard: "剪贴板", screenshot: "截图", agents: "AI Agent" },
  tabs: {
    music: "岛上显示",
    musicLyrics: "歌词来源",
    musicLyricsStyle: "歌词样式",
    clipboard: "打开与粘贴",
    clipboardHistory: "记录什么",
    clipboardSnippets: "常用语与提示词",
    clipboardData: "导入导出",
    screenshot: "截图",
    screenshotRecord: "录屏",
    behavior: "展开与收起",
    behaviorTuck: "贴边隐藏",
    behaviorAlerts: "系统提示",
    shortcuts: "全局",
    shortcutsIsland: "岛上",
    theme: "样式",
    appearance: "尺寸与内容",
    themeMarket: "主题市场",
    agents: "岛上显示",
    agentSessions: "会话列表",
    agentAlerts: "提醒",
    sounds: "声音",
    agentApprovals: "审批",
    agentConnect: "连接",
    agentRemote: "SSH 远程",
  },
  groups: {
    basics: "基础",
    features: "功能",
    agents: "AI Agent",
    extensions: "扩展",
  },
  overview: "概览",
  general: "通用",
  behavior: "行为",
  behaviorTuck: "贴边隐藏",
  behaviorAlerts: "系统提示",
  shortcutsIsland: "岛上按键",
  musicLyrics: "歌词来源",
  musicLyricsStyle: "歌词样式",
  clipboardHistory: "剪贴板记录",
  clipboardSnippets: "常用语与提示词",
  clipboardData: "剪贴板导入导出",
  screenshotRecord: "录屏",
  appearance: "外观",
  theme: "主题",
  themeMarket: "主题市场",
  shortcuts: "快捷键",
  messages: "消息",
  mail: "邮箱",
  todos: "待办",
  music: "音乐",
  clipboard: "剪贴板",
  translation: "翻译",
  shelf: "文件中转",
  screenshot: "截图",
  calendar: "日历",
  agents: "岛上显示",
  agentSessions: "会话列表",
  agentRemote: "SSH 远程",
  agentAlerts: "提醒",
  sounds: "声音",
  agentApprovals: "审批",
  agentConnect: "连接",
  plugins: "插件",
  market: "插件市场",
  about: "关于",
};

export const en: SettingsCategoriesText = {
  label: "Settings categories",
  search: {
    placeholder: "Search settings",
    clear: "Clear search",
    empty: "No matching settings",
  },
  expand: (group) => `Expand ${group}`,
  collapse: (group) => `Collapse ${group}`,
  keywords: {
    overview: "overview start beginner getting started common features turn on off enable",
    general: "startup launch login language position display monitor data folder backup restore",
    behavior: "expand hover collapse animation motion switch page",
    behaviorTuck: "tuck hide reveal minimise minimize tray menu bar fullscreen game quiet",
    behaviorAlerts: "system alerts volume brightness headphones bluetooth battery charger power camera microphone privacy",
    musicLyrics: "lyrics sources folder lrc online kugou netease offset",
    musicLyricsStyle: "lyrics style karaoke highlight glow colour color",
    clipboardHistory: "record images files passwords secrets exclude limit cleanup ocr",
    clipboardSnippets: "snippets phrases prompts ai",
    clipboardData: "import export backup move",
    screenshotRecord: "screen recording record gif mp4 frame rate quality sound microphone",
    shortcutsIsland: "island keys page switch approval esc drag",
    appearance: "size scale panel height display collapsed bar items order preview",
    theme: "colour color background opacity transparency glass font pixel corner preset style import export pulse",
    themeMarket: "themes skins colours colors download apply share",
    shortcuts: "keys hotkey keyboard global",
    todos: "tasks notes archive save folder export markdown",
    calendar: "events meeting caldav ics subscription holidays",
    music: "lyrics media playback waveform kugou netease",
    translation: "service model key api language",
    clipboard: "copy paste history images",
    shelf: "files drag drop cleanup",
    screenshot: "screen capture snip region magnifier colour picker fullscreen",
    messages: "qq wechat mail email notifications imap",
    agents: "claude code codex session title status light collapsed bar",
    agentSessions: "sessions cards usage hide filter",
    agentRemote: "ssh remote server host other computers",
    agentAlerts: "pop-up alerts notifications reply status marker",
    sounds: "sound pack",
    agentApprovals: "approve allow deny permission questions answer",
    agentConnect: "hooks install repair",
    plugins: "extensions installed folder developer updates island pages",
    market: "extensions plugins download install browse",
    about: "version updates check beta channel reset quit feedback star",
  },
  entries: { behavior: "Behavior", appearance: "Appearance", shortcuts: "Shortcuts", music: "Music", clipboard: "Clipboard", screenshot: "Screenshots", agents: "AI Agent" },
  tabs: {
    music: "On the island",
    musicLyrics: "Lyrics sources",
    musicLyricsStyle: "Lyrics style",
    clipboard: "Opening and pasting",
    clipboardHistory: "What is kept",
    clipboardSnippets: "Snippets and prompts",
    clipboardData: "Import and export",
    screenshot: "Screenshots",
    screenshotRecord: "Recording",
    behavior: "Expand and collapse",
    behaviorTuck: "Tucking",
    behaviorAlerts: "System alerts",
    shortcuts: "Global",
    shortcutsIsland: "On the island",
    theme: "Style",
    appearance: "Size and content",
    themeMarket: "Theme market",
    agents: "On the island",
    agentSessions: "Session list",
    agentAlerts: "Alerts",
    sounds: "Sounds",
    agentApprovals: "Approvals",
    agentConnect: "Connection",
    agentRemote: "SSH remote",
  },
  groups: {
    basics: "Basics",
    features: "Features",
    agents: "AI Agent",
    extensions: "Extensions",
  },
  overview: "Overview",
  general: "General",
  behavior: "Behavior",
  behaviorTuck: "Tucking",
  behaviorAlerts: "System alerts",
  shortcutsIsland: "Island keys",
  musicLyrics: "Lyrics sources",
  musicLyricsStyle: "Lyrics style",
  clipboardHistory: "Clipboard records",
  clipboardSnippets: "Snippets and prompts",
  clipboardData: "Clipboard import and export",
  screenshotRecord: "Recording",
  appearance: "Appearance",
  theme: "Theme",
  themeMarket: "Theme market",
  shortcuts: "Shortcuts",
  messages: "Messages",
  mail: "Mail",
  todos: "Todos",
  music: "Music",
  clipboard: "Clipboard",
  translation: "Translation",
  shelf: "File shelf",
  screenshot: "Screenshot",
  calendar: "Calendar",
  agents: "On the island",
  agentSessions: "Session list",
  agentRemote: "SSH remote",
  agentAlerts: "Alerts",
  sounds: "Sounds",
  agentApprovals: "Approvals",
  agentConnect: "Connection",
  plugins: "Plugins",
  market: "Plugin market",
  about: "About",
};
