export type PluginV3State = "running" | "waiting" | "failed" | "disabled" | "auto-disabled" | "safe-mode" | "loading" | "stopped" | "unloading";

export type PluginV3Connection = "connecting" | "open" | "reconnecting" | "failed" | "closed";

export type HostMemoryMeasureText = "private-working-set" | "phys-footprint" | "rss";

export type SettingsPluginsV3Text = {
  preview: string;
  host: string;
  connection: Record<PluginV3Connection, string>;
  hostDetail: (pid: number, node: string) => string;
  memoryTitles: Record<HostMemoryMeasureText, string>;
  memoryNotes: Record<HostMemoryMeasureText, string>;
  hostCpu: string;
  uptime: string;
  safeMode: string;
  safeModes: { "third-party": string; minimal: string };
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
  preview: "开发中：只在开发版设了 FUYU_PLUGINS_V3=1 时出现。",
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
  preview: "In development: shown only in a dev build started with FUYU_PLUGINS_V3=1.",
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
