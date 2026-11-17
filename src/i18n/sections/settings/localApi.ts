export type SettingsLocalApiText = {
  title: string;
  hint: string;
  allowWrite: string;
  allowWriteHint: string;
  address: string;
  configFile: string;
  token: string;
  tokenHint: string;
  copy: string;
  copied: string;
  resetToken: string;
  resetTokenConfirm: string;
  resetTokenHint: string;
  notRunning: string;
};

export const zhCN: SettingsLocalApiText = {
  title: "本机接口",
  hint: "让脚本和其他程序经 HTTP 读写待办和每日笔记、上报 AI Agent 状态。只接受本机请求，要带访问令牌。在插件页关掉本机接口后地址就不再监听。",
  allowWrite: "允许修改待办、笔记和 Agent 状态",
  allowWriteHint: "关闭时只能读取，写请求回 403。",
  address: "地址",
  configFile: "配置文件",
  token: "访问令牌",
  tokenHint: "令牌不在这里显示，复制后粘贴到脚本里。",
  copy: "复制",
  copied: "已复制",
  resetToken: "重新生成令牌",
  resetTokenConfirm: "确认换新",
  resetTokenHint: "换一个新令牌，用旧令牌的脚本立即失效。",
  notRunning: "没有在运行",
};

export const en: SettingsLocalApiText = {
  title: "Local API",
  hint: "Lets scripts and other programs read and change todos and the daily note and report AI agent status over HTTP. Only accepts requests from this computer, with an access token. Switching the local API off on the plugins page stops it listening.",
  allowWrite: "Allow changes to todos, notes and agent status",
  allowWriteHint: "When off, it can only read; writes answer 403.",
  address: "Address",
  configFile: "Config file",
  token: "Access token",
  tokenHint: "The token is not shown here; copy it and paste it into your script.",
  copy: "Copy",
  copied: "Copied",
  resetToken: "Regenerate token",
  resetTokenConfirm: "Confirm regenerate",
  resetTokenHint: "Switches to a new token; scripts using the old one stop working at once.",
  notRunning: "Not running",
};
