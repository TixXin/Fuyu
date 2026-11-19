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
};
