export type SettingsPermissionsText = {
  title: string;
  hint: string;
  kinds: Record<"accessibility" | "screenRecording", { title: string; description: string }>;
  granted: string;
  missing: string;
  open: string;
  allow: string;
  openAgain: string;
  restartNeeded: string;
  restart: string;
};

export const zhCN: SettingsPermissionsText = {
  title: "系统权限",
  hint: "在「系统设置 → 隐私与安全性」里给浮屿打开。屏幕录制授权后要重开浮屿才生效。",
  kinds: {
    accessibility: { title: "辅助功能", description: "剪贴板贴回原来的窗口、划词翻译读选中的文字、读 QQ 和微信的未读数。" },
    screenRecording: { title: "屏幕录制", description: "截图、贴图和长截图。" },
  },
  granted: "已允许",
  missing: "未允许",
  open: "打开系统设置",
  allow: "去允许",
  openAgain: "再打开设置",
  restartNeeded: "打开开关后，重开浮屿才生效",
  restart: "重开浮屿",
};

export const en: SettingsPermissionsText = {
  title: "System permissions",
  hint: "Turn these on for Fuyu in System Settings > Privacy & Security. Screen Recording takes effect after Fuyu restarts.",
  kinds: {
    accessibility: { title: "Accessibility", description: "Pasting clipboard items back, reading selected text for translation, and QQ and WeChat unread counts." },
    screenRecording: { title: "Screen Recording", description: "Screenshots, pins and long screenshots." },
  },
  granted: "Allowed",
  missing: "Not allowed",
  open: "Open System Settings",
  allow: "Allow",
  openAgain: "Open Settings again",
  restartNeeded: "After you turn it on, restart Fuyu for it to work",
  restart: "Restart Fuyu",
};
