export type PluginV3State = "running" | "waiting" | "failed" | "disabled" | "auto-disabled" | "safe-mode" | "loading" | "stopped" | "unloading";

export type PluginV3Connection = "connecting" | "open" | "reconnecting" | "failed" | "closed";

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
  preview: string;
  builtins: string;
  builtinsNote: string;
  builtinsLoading: string;
  builtinNames: Record<BuiltinPluginName, string>;
  essentialNote: string;
  hostOff: string;
  hostOffNote: string;
  node: {
    downloading: string;
    downloadingNote: string;
    progress: (downloaded: string, total: string) => string;
    progressUnknown: (downloaded: string) => string;
    failed: string;
    failedNote: string;
    retry: string;
  };
  host: string;
  connection: Record<PluginV3Connection, string>;
  hostDetail: (pid: number, node: string) => string;
  memoryTitles: Record<HostMemoryMeasureText, string>;
  memoryNotes: Record<HostMemoryMeasureText, string>;
  hostCpu: string;
  uptime: string;
  safeMode: string;
  safeModes: { "third-party": string; minimal: string };
  safeCauses: { variable: string; shift: string; failures: (count: number) => string };
  leaveSafeMode: string;
  devMode: string;
  plugins: string;
  empty: string;
  waitingHost: string;
  states: Record<PluginV3State, string>;
  kinds: { essential: string; builtin: string; "third-party": string };
  waitingFor: (services: string) => string;
  autoDisabled: (errors: number, seconds: number) => string;
  heldBySafeMode: (mode: string) => string;
  cpu: string;
  calls: (count: number) => string;
  apply: string;
  timers: string;
  listeners: string;
  services: string;
  clients: string;
  errors: string;
  lastError: string;
  cpuNote: string;
};

export const zhCN: SettingsPluginsV3Text = {
  preview: "开发中：开发版里总会出现，正式版要设了 FUYU_PLUGINS_V3=1 才出现。",
  builtins: "内置插件",
  builtinsNote: "开关存在数据目录的 plugins-v3/plugins.yml，宿主没开也生效。关掉的插件撤掉它的界面、停掉它的后台；功能迁成插件之前，关掉还看不出变化。",
  builtinsLoading: "正在读取内置插件。",
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
  essentialNote: "浮屿必需，不能关",
  hostOff: "宿主没开",
  hostOffNote: "测试版和开发版默认启动宿主，设 FUYU_PLUGINS_V3=0 就关掉；正式版设了 FUYU_PLUGINS_V3=1 才启动。内置插件的开关照样生效。",
  node: {
    downloading: "正在下载 Node",
    downloadingNote: "插件宿主要用 Node，这台电脑上没找到合适的版本。浮屿把它下载到自己的数据目录，只下一次。",
    progress: (downloaded, total) => `${downloaded} / ${total} MB`,
    progressUnknown: (downloaded) => `${downloaded} MB`,
    failed: "没能下载 Node",
    failedNote: "下载走系统代理。网络好了点「重试」，不用重启浮屿。",
    retry: "重试",
  },
  host: "宿主",
  connection: {
    connecting: "正在连接",
    open: "已连接",
    reconnecting: "宿主重启中，正在重连",
    failed: "连不上（协议版本不对）",
    closed: "已断开",
  },
  hostDetail: (pid, node) => `进程 ${pid} · Node ${node}`,
  memoryTitles: { "private-working-set": "内存（私有工作集）", "phys-footprint": "内存（phys_footprint）", rss: "内存（工作集）" },
  memoryNotes: {
    "private-working-set": "和任务管理器「内存」一栏同一个口径，不含和别的进程共享的页。",
    "phys-footprint": "和活动监视器「内存」一栏同一个口径。",
    rss: "宿主自己报的常驻内存，含共享页，比实际占用大。",
  },
  hostCpu: "累计 CPU",
  uptime: "已运行",
  safeMode: "安全模式",
  safeModes: { "third-party": "只停第三方插件", minimal: "只留最小的一组内置插件" },
  safeCauses: {
    variable: "由环境变量 FUYU_PLUGINS_V3_SAFE 打开，去掉这个变量后重启浮屿才会退出。",
    shift: "启动时按住了 Shift。只管这一次运行，下次正常启动就退出。",
    failures: (count) => `宿主连续 ${count} 次没能跑满 60 秒。在安全模式下跑满 60 秒后清零，下次启动照常。`,
  },
  leaveSafeMode: "退出安全模式",
  devMode: "开发模式（热重载）",
  plugins: "插件",
  empty: "plugins.yml 里还没有插件。",
  waitingHost: "等宿主连上后显示插件。",
  states: {
    running: "运行中",
    waiting: "等待中",
    failed: "启动失败",
    disabled: "已停用",
    "auto-disabled": "已自动停用",
    "safe-mode": "被安全模式拦下",
    loading: "加载中",
    stopped: "已停止",
    unloading: "正在停止",
  },
  kinds: { essential: "必需", builtin: "内置", "third-party": "第三方" },
  waitingFor: (services) => `在等服务：${services}`,
  autoDisabled: (errors, seconds) => `${seconds} 秒内出错 ${errors} 次，已停用到宿主下次重启；没有改 plugins.yml。`,
  heldBySafeMode: (mode) => `安全模式（${mode}）下不启动这个插件。`,
  cpu: "CPU",
  calls: (count) => `${count} 次回调`,
  apply: "启动耗时",
  timers: "定时器",
  listeners: "监听器",
  services: "服务",
  clients: "界面文件",
  errors: "出错",
  lastError: "最近一次出错",
  cpuNote: "CPU 是近似值：只算经内核登记的回调（事件监听、受管定时器、启动）的同步部分，await 之后的不算。",
};

export const en: SettingsPluginsV3Text = {
  preview: "In development: always shown in a dev build; a release build shows it only with FUYU_PLUGINS_V3=1.",
  builtins: "Built-in plugins",
  builtinsNote: "Switches are saved in plugins-v3/plugins.yml in the data folder and work without the host. A plugin switched off loses its UI and its background work; until a feature becomes a plugin, switching it off changes nothing yet.",
  builtinsLoading: "Reading the built-in plugins.",
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
  essentialNote: "Fuyu needs it; always on",
  hostOff: "Host not running",
  hostOffNote: "Beta and dev builds start the host unless FUYU_PLUGINS_V3=0; stable releases start it only with FUYU_PLUGINS_V3=1. Built-in plugin switches work either way.",
  node: {
    downloading: "Downloading Node",
    downloadingNote: "The plugin host needs Node, and no suitable version was found on this computer. Fuyu downloads it once into its own data folder.",
    progress: (downloaded, total) => `${downloaded} / ${total} MB`,
    progressUnknown: (downloaded) => `${downloaded} MB`,
    failed: "Could not download Node",
    failedNote: "The download uses the system proxy. Once the network is back, click Retry; no need to restart Fuyu.",
    retry: "Retry",
  },
  host: "Host",
  connection: {
    connecting: "Connecting",
    open: "Connected",
    reconnecting: "Host restarting, reconnecting",
    failed: "Can't connect (protocol mismatch)",
    closed: "Disconnected",
  },
  hostDetail: (pid, node) => `Process ${pid} · Node ${node}`,
  memoryTitles: { "private-working-set": "Memory (private working set)", "phys-footprint": "Memory (phys_footprint)", rss: "Memory (working set)" },
  memoryNotes: {
    "private-working-set": "Same measure as Task Manager's Memory column; pages shared with other processes are left out.",
    "phys-footprint": "Same measure as Activity Monitor's Memory column.",
    rss: "Resident memory reported by the host itself. It includes shared pages, so it reads higher than what the host really uses.",
  },
  hostCpu: "CPU so far",
  uptime: "Up for",
  safeMode: "Safe mode",
  safeModes: { "third-party": "Third-party plugins off", minimal: "Minimal built-ins only" },
  safeCauses: {
    variable: "Turned on by the FUYU_PLUGINS_V3_SAFE environment variable. Remove it and restart Fuyu to leave.",
    shift: "Shift was held at startup. It lasts for this run only.",
    failures: (count) => `The host failed to stay up for 60 seconds ${count} times in a row. The count clears after a minute in safe mode, and the next start is normal.`,
  },
  leaveSafeMode: "Leave safe mode",
  devMode: "Dev mode (hot reload)",
  plugins: "Plugins",
  empty: "No plugins in plugins.yml yet.",
  waitingHost: "Plugins show up once the host is connected.",
  states: {
    running: "Running",
    waiting: "Waiting",
    failed: "Failed",
    disabled: "Off",
    "auto-disabled": "Turned off",
    "safe-mode": "Held by safe mode",
    loading: "Loading",
    stopped: "Stopped",
    unloading: "Stopping",
  },
  kinds: { essential: "Essential", builtin: "Built-in", "third-party": "Third-party" },
  waitingFor: (services) => `Waiting for: ${services}`,
  autoDisabled: (errors, seconds) => `${errors} errors within ${seconds} s, so it's off until the host restarts. plugins.yml is unchanged.`,
  heldBySafeMode: (mode) => `Not started in safe mode (${mode}).`,
  cpu: "CPU",
  calls: (count) => `${count} ${count === 1 ? "call" : "calls"}`,
  apply: "Start time",
  timers: "Timers",
  listeners: "Listeners",
  services: "Services",
  clients: "UI files",
  errors: "Errors",
  lastError: "Last error",
  cpuNote: "CPU is approximate: only the synchronous part of callbacks registered through the kernel (listeners, managed timers, start) is counted, not what runs after an await.",
};
