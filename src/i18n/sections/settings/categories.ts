export type SettingsCategoriesText = {
  label: string;
  search: {
    placeholder: string;
    clear: string;
    empty: string;
  };
  expand: (group: string) => string;
  collapse: (group: string) => string;
  backTo: (page: string) => string;
  keywords: Record<
    | "overview" | "general" | "generalData" | "generalSync" | "generalApi" | "musicLyrics" | "musicLyricsStyle" | "clipboardHistory" | "clipboardSnippets" | "screenshotRecord" | "behavior" | "behaviorTuck" | "behaviorAlerts" | "timerAlerts" | "shortcutsIsland" | "shortcutsReference" | "appearance" | "appearanceCollapsed" | "theme" | "themeStyle" | "themeMarket" | "shortcuts" | "todos" | "calendar" | "music" | "translation" | "clipboard"
    | "shelf" | "screenshot" | "messages" | "messagesIm" | "messagesMail" | "agents" | "agentAppearance" | "agentSessions" | "agentRings" | "agentRemote" | "agentAlerts" | "sounds" | "agentPush" | "agentApprovals" | "agentConnect" | "voiceInput"
    | "pluginsV3" | "pluginMarket" | "pluginDiagnostics" | "about",
    string
  >;
  entries: { general: string; behavior: string; behaviorAlerts: string; appearance: string; shortcuts: string; music: string; clipboard: string; screenshot: string; messages: string; agents: string; agentAppearance: string; agentAlerts: string };
  tabs: Record<"general" | "generalData" | "generalSync" | "generalApi" | "music" | "clipboard" | "screenshot" | "musicLyrics" | "musicLyricsStyle" | "clipboardHistory" | "clipboardSnippets" | "screenshotRecord" | "behavior" | "behaviorTuck" | "behaviorAlerts" | "timerAlerts" | "shortcuts" | "shortcutsIsland" | "shortcutsReference" | "theme" | "themeStyle" | "appearance" | "appearanceCollapsed" | "themeMarket" | "messages" | "messagesIm" | "messagesMail" | "agents" | "agentAppearance" | "agentSessions" | "agentRings" | "agentAlerts" | "sounds" | "agentPush" | "agentApprovals" | "agentConnect", string>;
  groups: {
    basics: string;
    features: string;
    agents: string;
    extensions: string;
  };
  overview: string;
  general: string;
  generalData: string;
  generalSync: string;
  generalApi: string;
  behavior: string;
  behaviorTuck: string;
  behaviorAlerts: string;
  timerAlerts: string;
  shortcutsIsland: string;
  shortcutsReference: string;
  musicLyrics: string;
  musicLyricsStyle: string;
  clipboardHistory: string;
  clipboardSnippets: string;
  screenshotRecord: string;
  appearance: string;
  appearanceCollapsed: string;
  theme: string;
  themeStyle: string;
  themeMarket: string;
  shortcuts: string;
  messages: string;
  messagesIm: string;
  messagesMail: string;
  mail: string;
  todos: string;
  music: string;
  clipboard: string;
  translation: string;
  shelf: string;
  screenshot: string;
  voiceInput: string;
  calendar: string;
  agents: string;
  agentAppearance: string;
  agentSessions: string;
  agentRings: string;
  agentRemote: string;
  agentAlerts: string;
  sounds: string;
  agentPush: string;
  agentApprovals: string;
  agentConnect: string;
  pluginsV3: string;
  pluginMarket: string;
  pluginDiagnostics: string;
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
  backTo: (page) => `返回「${page}」`,
  keywords: {
    overview: "概览 开始 新手 入门 常用 功能 开启 关闭 启用",
    general: "开机 自启 登录 语言 托盘 菜单栏 权限",
    generalData: "数据 文件夹 备份 恢复 导出 导入 迁移",
    generalSync: "跨设备 同步 云盘 网盘 OneDrive iCloud 坚果云 Syncthing NAS 设备 合并",
    generalApi: "本机接口 Local API 令牌 端口 HTTP",
    behavior: "展开 悬停 收起 动画 切换页面 全屏 游戏 勿扰 免打扰",
    behaviorTuck: "贴边 隐藏 露出 最小化 托盘 菜单栏",
    behaviorAlerts: "系统提示 音量 亮度 耳机 蓝牙 电量 电源 充电 摄像头 麦克风 隐私",
    timerAlerts: "计时器 倒计时 番茄钟 响铃 声音 休息 提醒 久坐 护眼",
    musicLyrics: "歌词 来源 文件夹 LRC 在线 酷狗 网易云 提前 推后",
    musicLyricsStyle: "歌词 样式 逐字 高亮 发光 颜色 卡拉OK",
    clipboardHistory: "记录 图片 文件 密码 密钥 排除 条数 清理 OCR 导入 导出 备份 迁移 链接 书签 网址 网站 图标",
    clipboardSnippets: "常用语 短语 提示词 AI",
    screenshotRecord: "录屏 录制 GIF MP4 帧率 画质 声音 麦克风",
    shortcutsIsland: "岛上 按键 翻页 页面切换",
    shortcutsReference: "速查 Esc 拖动 调整大小 审批",
    appearance: "位置 显示器 屏幕 尺寸 大小 缩放 面板高度 形态 刘海",
    appearanceCollapsed: "显示内容 收起条 项目 排序 中心图案 宠物 眼睛",
    theme: "颜色 背景 浅色 深色 配色 强调色 亮点 文字 我的主题 预设 样式 导入 导出 保存",
    themeStyle: "风格 经典 像素 透明 不透明度 整体不透明度 闲置 变淡 鼠标穿透 点击穿透 字体 圆角 超椭圆 液态玻璃 折射 流光 模糊 高光",
    themeMarket: "主题 皮肤 配色 下载 应用 分享",
    shortcuts: "按键 组合键 热键 全局",
    todos: "任务 笔记 归档 待办 项目 标签 保存路径 文件夹 导出 Markdown",
    calendar: "日程 会议 倒计时 提醒 CalDAV ICS 订阅 节假日 日历来源",
    music: "歌词 媒体 播放 波形 酷狗 网易云",
    translation: "翻译服务 模型 密钥 API 语言",
    clipboard: "复制 粘贴 历史 图片",
    shelf: "文件 拖放 拖拽 清理",
    screenshot: "截屏 截图 快捷键 选区 放大镜 取色 全屏",
    voiceInput: "语音 说话 听写 麦克风 转文字 识别 模型",
    messages: "消息 提醒方式 横幅 面板 预览",
    messagesIm: "QQ 微信 通知 聊天",
    messagesMail: "邮箱 邮件 IMAP 授权码",
    agents: "Claude Code Codex 钩子 hook 安装 修复 状态灯 启用 代理 提供方 Cursor Gemini OpenCode WorkBuddy Antigravity DeepSeek Qoder CodeBuddy Qwen TRAE ZCode Kimi MiMo Grok Copilot Droid pi",
    agentAppearance: "会话标题 状态灯 收起条 岛上显示 外观",
    agentSessions: "会话 卡片 列表 隐藏会话 筛选 子会话",
    agentRings: "用量 用量环 会话环 额度 GLM Kimi Anthropic",
    agentRemote: "SSH 远程 服务器 主机 其他电脑 隧道 代理 转发 端口",
    agentAlerts: "弹出 提醒 通知",
    sounds: "音效 声音包 提示音",
    agentPush: "手机推送 Bark cc-connect 机器人 飞书",
    agentApprovals: "批准 允许 拒绝 权限 提问 回答 审批",
    agentConnect: "回复状态标记 编辑器扩展 VS Code Cursor 连接",
    pluginsV3: "插件 已安装 扩展 启用 停用 卸载 重启 出错 设置 权限 命令 快捷键 更新 从文件安装 .fuyu",
    pluginMarket: "插件市场 扩展 下载 安装 更新 官方 第三方 浏览 .fuyu",
    pluginDiagnostics: "运行诊断 插件进程 内存 CPU 占用 出错 安全模式 运行环境 Node 排查 二分 卡顿",
    about: "版本 更新 检查更新 测试版 通道 更新日志 版本历史 发行说明 帮助 新手引导 诊断 重置 退出 反馈 Star",
  },
  entries: {
    general: "通用",
    behavior: "行为",
    behaviorAlerts: "计时与提醒",
    appearance: "外观",
    shortcuts: "快捷键",
    music: "音乐",
    clipboard: "剪贴板",
    screenshot: "截图",
    messages: "消息",
    agents: "Agent",
    agentAppearance: "外观",
    agentAlerts: "提醒",
  },
  tabs: {
    general: "启动与托盘",
    generalData: "数据与备份",
    generalSync: "跨设备同步",
    generalApi: "本机接口",
    music: "岛上显示",
    musicLyrics: "歌词来源",
    musicLyricsStyle: "歌词样式",
    clipboard: "打开与粘贴",
    clipboardHistory: "记录与链接",
    clipboardSnippets: "常用语与提示词",
    screenshot: "截图",
    screenshotRecord: "录屏",
    behavior: "展开与收起",
    behaviorTuck: "贴边隐藏",
    behaviorAlerts: "系统提示",
    timerAlerts: "计时与休息",
    shortcuts: "全局",
    shortcutsIsland: "岛上",
    shortcutsReference: "速查表",
    theme: "主题与配色",
    themeStyle: "材质与圆角",
    appearance: "位置与尺寸",
    appearanceCollapsed: "收起条项目",
    themeMarket: "主题市场",
    messages: "提醒方式",
    messagesIm: "QQ 与微信",
    messagesMail: "邮箱",
    agents: "钩子与代理",
    agentConnect: "连接与扩展",
    agentApprovals: "审批",
    agentAppearance: "状态灯与标题",
    agentSessions: "会话列表",
    agentRings: "用量与会话环",
    agentAlerts: "桌面提醒",
    sounds: "声音",
    agentPush: "推送与机器人",
  },
  groups: {
    basics: "基础",
    features: "功能",
    agents: "AI Agent",
    extensions: "扩展",
  },
  overview: "概览",
  general: "通用",
  generalData: "数据与备份",
  generalSync: "跨设备同步",
  generalApi: "本机接口",
  behavior: "行为",
  behaviorTuck: "贴边隐藏",
  behaviorAlerts: "系统提示",
  timerAlerts: "计时与休息",
  shortcutsIsland: "岛上按键",
  shortcutsReference: "按键速查表",
  musicLyrics: "歌词来源",
  musicLyricsStyle: "歌词样式",
  clipboardHistory: "记录与链接",
  clipboardSnippets: "常用语与提示词",
  screenshotRecord: "录屏",
  appearance: "位置与尺寸",
  appearanceCollapsed: "收起条项目",
  theme: "主题与配色",
  themeStyle: "材质与圆角",
  themeMarket: "主题市场",
  shortcuts: "快捷键",
  messages: "消息",
  messagesIm: "QQ 与微信",
  messagesMail: "邮箱",
  mail: "邮箱",
  todos: "待办",
  music: "音乐",
  clipboard: "剪贴板",
  translation: "翻译",
  shelf: "文件中转",
  screenshot: "截图",
  voiceInput: "语音输入",
  calendar: "日历",
  agents: "钩子与代理",
  agentAppearance: "状态灯与标题",
  agentSessions: "会话列表",
  agentRings: "用量与会话环",
  agentRemote: "SSH 远程",
  agentAlerts: "桌面提醒",
  sounds: "声音",
  agentPush: "推送与机器人",
  agentApprovals: "审批",
  agentConnect: "连接与扩展",
  pluginsV3: "插件",
  pluginMarket: "插件市场",
  pluginDiagnostics: "运行诊断",
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
  backTo: (page) => `Back to ${page}`,
  keywords: {
    overview: "overview start beginner getting started common features turn on off enable",
    general: "startup launch login language tray menu bar permissions",
    generalData: "data folder backup restore export import move",
    generalSync: "cross-device sync cloud drive onedrive icloud nutstore syncthing nas devices merge",
    generalApi: "local api token port http",
    behavior: "expand hover collapse animation motion switch page fullscreen game quiet do not disturb",
    behaviorTuck: "tuck hide reveal minimise minimize tray menu bar",
    behaviorAlerts: "system alerts volume brightness headphones bluetooth battery charger power camera microphone privacy",
    timerAlerts: "timer countdown pomodoro alarm sound break reminder rest eye",
    musicLyrics: "lyrics sources folder lrc online kugou netease offset",
    musicLyricsStyle: "lyrics style karaoke highlight glow colour color",
    clipboardHistory: "record images files passwords secrets exclude limit cleanup ocr import export backup move links bookmarks url website favicon",
    clipboardSnippets: "snippets phrases prompts ai",
    screenshotRecord: "screen recording record gif mp4 frame rate quality sound microphone",
    shortcutsIsland: "island keys page switch",
    shortcutsReference: "reference sheet esc drag resize approval",
    appearance: "position display monitor screen size scale panel height form notch",
    appearanceCollapsed: "display collapsed bar items order center pattern pet eyes",
    theme: "colour color background light dark tone accent pulse ink my themes preset style import export save",
    themeStyle: "style classic pixel opacity island opacity idle dim fade click through passthrough transparency font corner squircle liquid glass refraction flow blur specular",
    themeMarket: "themes skins colours colors download apply share",
    shortcuts: "keys hotkey keyboard global",
    todos: "tasks notes archive todos projects tags save folder export markdown",
    calendar: "events meeting countdown reminder caldav ics subscription holidays calendar sources",
    music: "lyrics media playback waveform kugou netease",
    translation: "service model key api language",
    clipboard: "copy paste history images",
    shelf: "files drag drop cleanup",
    screenshot: "screen capture snip region magnifier colour picker fullscreen",
    voiceInput: "voice speech dictation microphone speech to text model",
    messages: "messages notice style banner panel preview",
    messagesIm: "qq wechat notifications chat",
    messagesMail: "mail email imap",
    agents: "claude code codex hooks install repair status light enable agents providers cursor gemini opencode workbuddy antigravity deepseek qoder codebuddy qwen trae zcode kimi mimo grok copilot droid pi",
    agentAppearance: "session title status light collapsed bar on the island appearance",
    agentSessions: "sessions cards list hide filter subagent",
    agentRings: "usage ring session ring quota glm kimi anthropic",
    agentRemote: "ssh remote server host other computers tunnel proxy forward port",
    agentAlerts: "pop-up alerts notifications",
    sounds: "sound pack",
    agentPush: "mobile push bark cc-connect bot feishu",
    agentApprovals: "approve allow deny permission questions answer",
    agentConnect: "reply status marker editor extension vs code cursor connection",
    pluginsV3: "plugins installed extensions enable disable uninstall restart errors settings permissions commands shortcuts updates install from file .fuyu",
    pluginMarket: "plugin market store extensions download install update official browse .fuyu",
    pluginDiagnostics: "diagnostics plugin process memory cpu usage errors safe mode runtime node troubleshoot bisect slow",
    about: "version updates check beta channel changelog version history release notes help onboarding guide diagnostics reset quit feedback star",
  },
  entries: {
    general: "General",
    behavior: "Behavior",
    behaviorAlerts: "Timer & alerts",
    appearance: "Appearance",
    shortcuts: "Shortcuts",
    music: "Music",
    clipboard: "Clipboard",
    screenshot: "Screenshots",
    messages: "Messages",
    agents: "Agent",
    agentAppearance: "Appearance",
    agentAlerts: "Alerts",
  },
  tabs: {
    general: "Startup and tray",
    generalData: "Data and backup",
    generalSync: "Cross-device sync",
    generalApi: "Local API",
    music: "On the island",
    musicLyrics: "Lyrics sources",
    musicLyricsStyle: "Lyrics style",
    clipboard: "Opening and pasting",
    clipboardHistory: "Records and links",
    clipboardSnippets: "Snippets and prompts",
    screenshot: "Screenshots",
    screenshotRecord: "Recording",
    behavior: "Expand and collapse",
    behaviorTuck: "Tucking",
    behaviorAlerts: "System alerts",
    timerAlerts: "Timer and breaks",
    shortcuts: "Global",
    shortcutsIsland: "On the island",
    shortcutsReference: "Reference",
    theme: "Theme and colors",
    themeStyle: "Material and corners",
    appearance: "Position and size",
    appearanceCollapsed: "Collapsed bar",
    themeMarket: "Theme market",
    messages: "Notice style",
    messagesIm: "QQ and WeChat",
    messagesMail: "Mail",
    agents: "Hooks and agents",
    agentConnect: "Connection",
    agentApprovals: "Approvals",
    agentAppearance: "Light and title",
    agentSessions: "Session list",
    agentRings: "Usage and session rings",
    agentAlerts: "Desktop alerts",
    sounds: "Sounds",
    agentPush: "Push and bots",
  },
  groups: {
    basics: "Basics",
    features: "Features",
    agents: "AI Agent",
    extensions: "Extensions",
  },
  overview: "Overview",
  general: "General",
  generalData: "Data and backup",
  generalSync: "Cross-device sync",
  generalApi: "Local API",
  behavior: "Behavior",
  behaviorTuck: "Tucking",
  behaviorAlerts: "System alerts",
  timerAlerts: "Timer and breaks",
  shortcutsIsland: "Island keys",
  shortcutsReference: "Key reference",
  musicLyrics: "Lyrics sources",
  musicLyricsStyle: "Lyrics style",
  clipboardHistory: "Records and links",
  clipboardSnippets: "Snippets and prompts",
  screenshotRecord: "Recording",
  appearance: "Position and size",
  appearanceCollapsed: "Collapsed bar",
  theme: "Theme and colors",
  themeStyle: "Material and corners",
  themeMarket: "Theme market",
  shortcuts: "Shortcuts",
  messages: "Messages",
  messagesIm: "QQ and WeChat",
  messagesMail: "Mail",
  mail: "Mail",
  todos: "Todos",
  music: "Music",
  clipboard: "Clipboard",
  translation: "Translation",
  shelf: "File shelf",
  screenshot: "Screenshot",
  voiceInput: "Voice input",
  calendar: "Calendar",
  agents: "Hooks and agents",
  agentAppearance: "Light and title",
  agentSessions: "Session list",
  agentRings: "Usage and session rings",
  agentRemote: "SSH remote",
  agentAlerts: "Desktop alerts",
  sounds: "Sounds",
  agentPush: "Push and bots",
  agentApprovals: "Approvals",
  agentConnect: "Connection",
  pluginsV3: "Plugins",
  pluginMarket: "Plugin market",
  pluginDiagnostics: "Diagnostics",
  about: "About",
};
