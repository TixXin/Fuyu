export type SettingsGeneralLogsText = {
  title: string;
  none: string;
  latest: (fileName: string) => string;
  locate: string;
  locateMac: string;
  openDir: string;
  openDirMac: string;
  hint: string;
  hintMac: string;
  graphics: {
    compatTitle: string;
    compatHint: string;
    autoNotice: (reason: string | null) => string;
    restartNeeded: string;
    restartNow: string;
    clearCacheTitle: string;
    clearCacheHint: string;
    clearCacheAction: string;
    footnote: string;
  };
};

export const zhCN: SettingsGeneralLogsText = {
  title: "崩溃诊断日志",
  none: "当前暂无崩溃记录",
  latest: (fileName) => `最新记录：${fileName}`,
  locate: "定位最新日志",
  locateMac: "在访达中定位",
  openDir: "打开日志目录",
  openDirMac: "在访达中打开",
  hint: "遇到原生闪退或睡眠唤醒后 WebView 渲染/GPU 进程异常退出时，时间、位置与脱敏摘要会自动写入数据文件夹下的 crash.log 与 webview-crashes.log；界面出错时的错误摘要写入 frontend-errors.log（各保留最近 64 KB，不含环境变量或个人数据）。",
  hintMac: "遇到原生闪退时，时间、位置与脱敏摘要会自动写入数据文件夹下的 crash.log；界面出错时的错误摘要写入 frontend-errors.log（各保留最近 64 KB，不含环境变量或个人数据）。",
  graphics: {
    compatTitle: "兼容软渲染模式（WARP）",
    compatHint: "绕过显卡硬件加速改用系统 WARP 软渲染（保持透明窗口），可缓解显卡驱动或虚拟显示软件导致的岛屿不显示、设置黑屏。",
    autoNotice: (reason) => reason
      ? `检测到显卡渲染进程反复崩溃（${reason}），已自动切换为兼容软渲染。更新驱动或排查冲突显示软件后可尝试关闭并重启。`
      : "检测到显卡渲染进程反复崩溃，已自动切换为兼容软渲染。更新驱动或排查冲突显示软件后可尝试关闭并重启。",
    restartNeeded: "渲染模式已保存，重启浮屿后生效。",
    restartNow: "立即重启",
    clearCacheTitle: "清理 WebView 图形缓存",
    clearCacheHint: "仅删除着色器与 GPU 缓存并重启，不清除本地设置和待办数据。",
    clearCacheAction: "清理并重启",
    footnote: "Windows 硬件模式下若 1 分钟内 GPU 进程连崩 3 次，浮屿会自动切入兼容软渲染并重启；也可以用 --software-rendering 启动参数临时启用。",
  },
};

export const en: SettingsGeneralLogsText = {
  title: "Crash logs",
  none: "No crash records yet",
  latest: (fileName) => `Latest: ${fileName}`,
  locate: "Locate latest log",
  locateMac: "Reveal in Finder",
  openDir: "Open log folder",
  openDirMac: "Open in Finder",
  hint: "When a native crash or WebView renderer/GPU exit occurs (such as after waking from sleep), the time, location and sanitized summary are written to crash.log and webview-crashes.log in the data folder; when the interface hits an error, a summary goes to frontend-errors.log (capped at 64 KB each, without environment variables or personal data).",
  hintMac: "When a native crash occurs, the time, location and sanitized summary are written to crash.log in the data folder; when the interface hits an error, a summary goes to frontend-errors.log (capped at 64 KB each, without environment variables or personal data).",
  graphics: {
    compatTitle: "Compatibility software rendering (WARP)",
    compatHint: "Uses Windows WARP software rendering instead of hardware GPU acceleration while keeping window transparency. Helps recover from blank islands or black screens caused by GPU drivers or virtual display software.",
    autoNotice: (reason) => reason
      ? `Switched to compatibility rendering automatically after repeated GPU crashes (${reason}). Turn off and restart after updating your graphics driver.`
      : "Switched to compatibility rendering automatically after repeated GPU crashes. Turn off and restart after updating your graphics driver.",
    restartNeeded: "Rendering mode saved. Restart Fuyu to apply.",
    restartNow: "Restart now",
    clearCacheTitle: "Clear WebView graphics cache",
    clearCacheHint: "Removes only GPU shader caches and restarts; keeps settings, todos, and local data intact.",
    clearCacheAction: "Clear & restart",
    footnote: "If the WebView2 GPU process crashes 3 times within a minute on Windows, Fuyu switches to WARP rendering and restarts automatically. You can also launch with --software-rendering.",
  },
};
