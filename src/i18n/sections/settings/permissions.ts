export type SettingsPermissionsText = {
  title: string;
  hint: string;
  kinds: Record<"accessibility" | "screenRecording", { title: string; description: string }>;
  granted: string;
  missing: string;
  open: string;
};

export const zhCN: SettingsPermissionsText = {
  title: "系统权限",
  hint: "在「系统设置 → 隐私与安全性」里给浮屿打开。屏幕录制授权后要重开浮屿才生效。",
  kinds: {
    accessibility: { title: "辅助功能", description: "剪贴板贴回原来的窗口、划词翻译读选中的文字。" },
    screenRecording: { title: "屏幕录制", description: "截图、贴图和长截图。" },
  },
  granted: "已允许",
  missing: "未允许",
  open: "打开系统设置",
};

export const en: SettingsPermissionsText = {
  title: "System permissions",
  hint: "Turn these on for Fuyu in System Settings > Privacy & Security. Screen Recording takes effect after Fuyu restarts.",
  kinds: {
    accessibility: { title: "Accessibility", description: "Pasting clipboard items back and reading selected text for translation." },
    screenRecording: { title: "Screen Recording", description: "Screenshots, pins and long screenshots." },
  },
  granted: "Allowed",
  missing: "Not allowed",
  open: "Open System Settings",
};
