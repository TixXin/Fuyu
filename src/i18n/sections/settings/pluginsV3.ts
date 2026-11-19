import { en as enPage, zhCN as zhPage, type SettingsPluginPageText } from "./pluginPage.ts";
import { en as enMarket, zhCN as zhMarket, type SettingsPluginMarketText } from "./pluginMarket.ts";

export type PluginV3State = "running" | "waiting" | "failed" | "disabled" | "auto-disabled" | "safe-mode" | "bisect" | "loading" | "stopped" | "unloading";

export type HostMemoryMeasureText = "private-working-set" | "phys-footprint" | "rss";

export type BuiltinPluginName =
  | "todos"
  | "calendar"
  | "music"
  | "clipboard"
  | "screenshot"
  | "file-shelf"
  | "translation"
  | "voice-input"
  | "timer"
  | "agents"
  | "session-ring"
  | "claude-usage"
  | "cc-connect"
  | "ssh-tunnel"
  | "local-api"
  | "center-pattern"
  | "messages"
  | "device-events"
  | "system-levels"
  | "device-use"
  | "theme-market"
  | "updater";

export type SettingsPluginsV3Text = {
  page: SettingsPluginPageText;
  marketPage: SettingsPluginMarketText;
  searchPlaceholder: string;
  noMatches: string;
  closeDetail: string;
  clearSearch: string;
  stateCol: string;
  builtinSummaries: Record<BuiltinPluginName, string>;
  builtinNames: Record<BuiltinPluginName, string>;
  memoryTitles: Record<HostMemoryMeasureText, string>;
  memoryNotes: Record<HostMemoryMeasureText, string>;
  hostCpu: string;
  uptime: string;
  safeModes: { "third-party": string; minimal: string };
  devMode: string;
  states: Record<PluginV3State, string>;
  waitingFor: (services: string) => string;
  waitingReasons?: {
    noProvider: (service: string) => string;
    providerInactive: (service: string, provider: string, state: string) => string;
    providerStarting: (service: string, provider: string) => string;
  };
  serviceReplacedBy?: (service: string, by: string) => string;
  serviceYielded?: (service: string) => string;
  undeclaredBadge?: (items: string) => string;
  bisect?: {
    testing: (step: number, count: number, ids: string) => string;
    fixed: string;
    stillBroken: string;
    found: (name: string) => string;
    clear: string;
    restore: string;
  };
  autoDisabled: (errors: number, seconds: number) => string;
  heldBySafeMode: (mode: string) => string;
  cpu: string;
  calls: (count: number) => string;
  apply: string;
  timers: string;
  listeners: string;
  services: string;
  clients: string;
  resourcesCol: string;
  errors: string;
  schemaForm: {
    heading: string;
    resetBtn: string;
    resettingBtn: string;
  };
  windowRules: {
    heading: string;
    openCount: (count: number) => string;
    disallowAlwaysOnTop: string;
    disallowAlwaysOnTopHint: string;
    disallowClickThrough: string;
    disallowClickThroughHint: string;
    hideAll: string;
    hideAllHint: string;
  };
};

export const zhCN: SettingsPluginsV3Text = {
  page: zhPage,
  marketPage: zhMarket,
  searchPlaceholder: "搜索插件名称、ID 或说明…",
  noMatches: "没有匹配的插件。",
  closeDetail: "关闭",
  clearSearch: "清除搜索",
  stateCol: "状态",
  builtinSummaries: {
    todos: "待办列表、每日笔记与归档，提供 todos/v1 服务",
    calendar: "日程视图与收起条会前倒计时，提供 calendar/v1 服务",
    music: "媒体控制、封面取色与同步歌词，提供 media/v1 服务",
    clipboard: "剪贴板历史、独立弹窗与空格预览，提供 clipboard/v1 服务",
    screenshot: "区域截图、屏幕贴图与录屏快捷键",
    "file-shelf": "拖入小岛暂存文件、拖出与批量打开，提供 file-shelf/v1 服务",
    translation: "划词翻译、独立翻译窗与 AI 改写，提供 translator/v1 服务",
    "voice-input": "按住快捷键语音转文字并写入待办或笔记",
    timer: "倒计时、番茄钟与休息提醒，提供 timers/v1 服务",
    agents: "AI 代理会话状态、工具审批与远程连接，提供 agents/v1 服务",
    "session-ring": "收起条上的 Agent 会话分段环；读 AI Agent 插件的会话列表",
    "claude-usage": "收起条上的 Agent 用量双环（Claude、Codex、GLM、Kimi）",
    "cc-connect": "设置在 AI Agent → 提醒；关掉后手机推送的 cc-connect 通道也停用",
    "ssh-tunnel": "设置在 AI Agent → SSH 远程；只支持 Windows，关掉后反向隧道结束",
    "local-api": "设置在 通用 → 本机接口；转给待办、AI Agent、剪贴板的请求，那个插件关着时回 503",
    "center-pattern": "收起条中心的眼睛动画与随 Agent 状态变表情的宠物",
    messages: "QQ、微信提醒与多邮箱收信",
    "device-events": "耳机连接断开、蓝牙低电量与插拔电源时在小岛提示",
    "system-levels": "调节音量或亮度时在收起的小岛或刘海两侧提示",
    "device-use": "应用占用摄像头或麦克风时在收起条显示图标",
    "theme-market": "浏览、预览并应用社区主题或保存为本地预设",
    updater: "后台检查版本更新与应用内安装",
  },
  builtinNames: {
    todos: "待办",
    calendar: "日历",
    music: "音乐和歌词",
    clipboard: "剪贴板",
    screenshot: "截图和录屏",
    "file-shelf": "文件中转",
    translation: "快捷翻译",
    "voice-input": "语音输入",
    timer: "计时器",
    agents: "AI 代理",
    "session-ring": "会话环",
    "claude-usage": "Claude 用量",
    "cc-connect": "cc-connect 手机连接",
    "ssh-tunnel": "SSH 代理隧道",
    "local-api": "本机接口",
    "center-pattern": "中心图案",
    messages: "消息",
    "device-events": "设备提示",
    "system-levels": "音量和亮度提示",
    "device-use": "摄像头和麦克风提示",
    "theme-market": "主题市场",
    updater: "自动更新",
  },
  memoryTitles: { "private-working-set": "内存（私有工作集）", "phys-footprint": "内存（phys_footprint）", rss: "内存（工作集）" },
  memoryNotes: {
    "private-working-set": "和任务管理器「内存」一栏同一个口径，不含和别的进程共享的页。",
    "phys-footprint": "和活动监视器「内存」一栏同一个口径。",
    rss: "插件进程自己报的常驻内存，含共享页，比实际占用大。",
  },
  hostCpu: "累计 CPU",
  uptime: "已运行",
  safeModes: { "third-party": "停用你装的插件", minimal: "只留必需的部分" },
  devMode: "开发模式（热重载）",
  states: {
    running: "运行中",
    waiting: "等待中",
    failed: "启动失败",
    disabled: "已停用",
    "auto-disabled": "已自动停用",
    "safe-mode": "被安全模式拦下",
    bisect: "排查停用中",
    loading: "加载中",
    stopped: "已停止",
    unloading: "正在停止",
  },
  waitingFor: (services) => `在等服务：${services}`,
  waitingReasons: {
    noProvider: (service) => `没有插件提供 ${service}`,
    providerInactive: (service, provider, state) => `${provider} 提供 ${service}，但它${state}`,
    providerStarting: (service, provider) => `${provider} 正在启动以提供 ${service}`,
  },
  serviceReplacedBy: (service, by) => `服务 ${service} 已由插件 ${by} 接管`,
  serviceYielded: (service) => `已让出服务 ${service}`,
  undeclaredBadge: (items) => `未在清单声明：${items}`,
  bisect: {
    testing: (step, count, ids) => `第 ${step} 步：已临时停用 ${count} 个插件（${ids}），问题消失了吗？`,
    fixed: "问题消失了",
    stillBroken: "问题还在",
    found: (name) => `问题出在「${name}」，先让它保持停用`,
    clear: "停掉你装的插件后问题还在，所以不是它们引起的，已全部恢复。",
    restore: "结束并恢复全部",
  },
  autoDisabled: (errors, seconds) => `${seconds} 秒内出错 ${errors} 次，先停用到浮屿下次启动；你的开关没变。`,
  heldBySafeMode: (mode) => `安全模式（${mode}）下不启动这个插件。`,
  cpu: "CPU",
  calls: (count) => `${count} 次回调`,
  apply: "启动耗时",
  timers: "定时器",
  listeners: "监听器",
  services: "服务",
  clients: "界面文件",
  resourcesCol: "活跃资源",
  errors: "出错",
  schemaForm: {
    heading: "插件设置",
    resetBtn: "恢复默认设置",
    resettingBtn: "正在恢复…",
  },
  windowRules: {
    heading: "独立窗口",
    openCount: (count) => `${count} 个活动窗口`,
    disallowAlwaysOnTop: "不允许置顶",
    disallowAlwaysOnTopHint: "禁止此插件的独立窗口始终置顶",
    disallowClickThrough: "不允许点击穿透",
    disallowClickThroughHint: "禁止此插件将窗口设为鼠标穿透",
    hideAll: "隐藏全部窗口",
    hideAllHint: "立即隐藏并阻止显示此插件的全部独立窗口",
  },
};

export const en: SettingsPluginsV3Text = {
  page: enPage,
  marketPage: enMarket,
  searchPlaceholder: "Search plugin name, ID or notes…",
  noMatches: "No matching plugins.",
  closeDetail: "Close",
  clearSearch: "Clear search",
  stateCol: "State",
  builtinSummaries: {
    todos: "To-dos, daily notes and archive; provides todos/v1",
    calendar: "Schedule view and pre-meeting countdown; provides calendar/v1",
    music: "Media controls, cover tint and synced lyrics; provides media/v1",
    clipboard: "Clipboard history, popup and Space preview; provides clipboard/v1",
    screenshot: "Region capture, pinned screenshots and screen recording shortcuts",
    "file-shelf": "Drop files onto the island to hold, drag out or open; provides file-shelf/v1",
    translation: "Selection translation, popup window and AI rewrite; provides translator/v1",
    "voice-input": "Hold shortcut to transcribe speech into to-dos or notes",
    timer: "Countdown, pomodoro and break reminders; provides timers/v1",
    agents: "AI agent session status, tool approvals and remote links; provides agents/v1",
    "session-ring": "Segmented session ring on the collapsed bar; reads AI Agent sessions",
    "claude-usage": "Dual usage rings on the collapsed bar (Claude, Codex, GLM, Kimi)",
    "cc-connect": "Settings under AI Agent → Alerts; off also stops cc-connect phone push",
    "ssh-tunnel": "Settings under AI Agent → SSH remote; Windows only, off ends reverse tunnels",
    "local-api": "Settings under General → Local API; answers 503 when target plugin is off",
    "center-pattern": "Center eye animation and pets that react to AI Agent states",
    messages: "QQ, WeChat and mail alerts",
    "device-events": "Headphone, low battery and power alerts on the collapsed island",
    "system-levels": "Volume and brightness popups on the collapsed island or notch",
    "device-use": "Camera and microphone indicator on the collapsed bar",
    "theme-market": "Browse, preview and apply community themes or save as presets",
    updater: "Background update checks and in-app installation",
  },
  builtinNames: {
    todos: "To-dos",
    calendar: "Calendar",
    music: "Music and lyrics",
    clipboard: "Clipboard",
    screenshot: "Screenshots and recording",
    "file-shelf": "File shelf",
    translation: "Quick translation",
    "voice-input": "Voice input",
    timer: "Timer",
    agents: "AI agents",
    "session-ring": "Session ring",
    "claude-usage": "Claude usage",
    "cc-connect": "cc-connect phone link",
    "ssh-tunnel": "SSH proxy tunnel",
    "local-api": "Local API",
    "center-pattern": "Center pattern",
    messages: "Messages",
    "device-events": "Device alerts",
    "system-levels": "Volume and brightness",
    "device-use": "Camera and mic in use",
    "theme-market": "Theme market",
    updater: "Updates",
  },
  memoryTitles: { "private-working-set": "Memory (private working set)", "phys-footprint": "Memory (phys_footprint)", rss: "Memory (working set)" },
  memoryNotes: {
    "private-working-set": "Same measure as Task Manager's Memory column; pages shared with other processes are left out.",
    "phys-footprint": "Same measure as Activity Monitor's Memory column.",
    rss: "Resident memory the plugin process reports for itself. It includes shared pages, so it reads higher than what it really uses.",
  },
  hostCpu: "CPU so far",
  uptime: "Up for",
  safeModes: { "third-party": "Your plugins off", minimal: "Essentials only" },
  devMode: "Dev mode (hot reload)",
  states: {
    running: "Running",
    waiting: "Waiting",
    failed: "Failed",
    disabled: "Off",
    "auto-disabled": "Turned off",
    "safe-mode": "Held by safe mode",
    bisect: "Held by bisect",
    loading: "Loading",
    stopped: "Stopped",
    unloading: "Stopping",
  },
  waitingFor: (services) => `Waiting for: ${services}`,
  waitingReasons: {
    noProvider: (service) => `No plugin provides ${service}`,
    providerInactive: (service, provider, state) => `${provider} provides ${service}, but it is ${state.toLowerCase()}`,
    providerStarting: (service, provider) => `${provider} is starting to provide ${service}`,
  },
  serviceReplacedBy: (service, by) => `Service ${service} is replaced by ${by}`,
  serviceYielded: (service) => `Yielded service ${service}`,
  undeclaredBadge: (items) => `Undeclared in manifest: ${items}`,
  bisect: {
    testing: (step, count, ids) => `Step ${step}: Temporarily turned off ${count} plugin(s) (${ids}). Is the problem gone?`,
    fixed: "Problem is gone",
    stillBroken: "Still happening",
    found: (name) => `The problem comes from ${name}; it stays off for now`,
    clear: "The problem stayed with your plugins off, so they are not the cause; all are back on.",
    restore: "Finish & restore all",
  },
  autoDisabled: (errors, seconds) => `${errors} errors within ${seconds} s, so it's off until Fuyu starts again. Your switch is unchanged.`,
  heldBySafeMode: (mode) => `Not started in safe mode (${mode}).`,
  cpu: "CPU",
  calls: (count) => `${count} ${count === 1 ? "call" : "calls"}`,
  apply: "Start time",
  timers: "Timers",
  listeners: "Listeners",
  services: "Services",
  clients: "UI files",
  resourcesCol: "Resources",
  errors: "Errors",
  schemaForm: {
    heading: "Plugin settings",
    resetBtn: "Reset defaults",
    resettingBtn: "Resetting…",
  },
  windowRules: {
    heading: "Separate windows",
    openCount: (count) => `${count} open ${count === 1 ? "window" : "windows"}`,
    disallowAlwaysOnTop: "Disallow always on top",
    disallowAlwaysOnTopHint: "Prevent this plugin's windows from staying above other apps",
    disallowClickThrough: "Disallow click-through",
    disallowClickThroughHint: "Prevent this plugin from making windows ignore mouse clicks",
    hideAll: "Hide all windows",
    hideAllHint: "Immediately hide and keep all windows from this plugin hidden",
  },
};
