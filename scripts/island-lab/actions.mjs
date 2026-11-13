export const NOTCHES = [
  { label: "Air 13 寸（208×37.5）", width: 208, height: 37.5 },
  { label: "Pro 14 寸（185×32）", width: 185, height: 32 },
  { label: "Pro 16 寸（185×38）", width: 185, height: 38 },
];

export const PAGES = [
  ["todo", "待办"], ["agents", "Agent"], ["music", "音乐"], ["calendar", "日历"],
  ["qq", "消息"], ["clipboard", "剪贴板"], ["shelf", "文件中转"], ["screenshots", "截图"],
];

export function qqMessage(now, title = "张三", body = "下午三点的会改到四点了，记得带上周报") {
  const id = `lab-${now}`;
  return {
    event: "qq-notifications-changed",
    payload: {
      snapshot: { revision: now, enabled: true, status: "listening", items: [{ id, title, body, createdAt: now }], error: null },
      newestId: id,
      windowVisible: true,
    },
  };
}

export function wechatMessage(now, chat = "产品群", contact = "李四", preview = "新版设计稿放在共享盘了，大家看一下") {
  const message = { chat, contact, preview, unread: 3, at: now };
  return {
    event: "wechat-reminder-changed",
    payload: {
      snapshot: {
        revision: now, enabled: true, status: "listening", pending: true, lastAttentionAt: now, error: null,
        message, items: [{ at: now, message, reason: null }], exposeUi: false, exposeStatus: null, hideTaskbarButton: false,
      },
      windowVisible: true,
    },
  };
}

export function pluginNotification(layout = "inline") {
  return {
    event: "plugin-notification",
    payload: {
      pluginId: "dev.lab", pluginName: { zh: "实验台", en: "Lab" }, title: "构建完成",
      body: layout === "card" ? "main 分支的 CI 跑完了，34 个回归页全部通过。" : "CI 全部通过",
      durationMs: 6000, actions: layout === "card" ? [{ id: "open", title: "查看" }] : [], icon: "plugin", layout,
    },
  };
}

export const levelChange = (kind, level, muted = false) => ({
  event: "system-level-changed",
  payload: kind === "volume" ? { kind, level, muted } : { kind, level },
});

export const deviceAlert = (payload) => ({ event: "device-alert", payload });

export function agentStatus(phase, title = "给岛加上刘海形态") {
  return { phase, name: "实验台", title, agent: "claudeCode" };
}

export function permissionRequest(now, agent = "claude") {
  return {
    session_id: `lab-${now}`, cwd: "/Users/you/projects/demo", hook_event_name: "PermissionRequest",
    tool_name: "Bash", tool_input: { command: agent === "codex" ? "pnpm test" : "git push origin main", description: "实验台发起的审批" },
  };
}

export function questionRequest(now) {
  return {
    session_id: `lab-${now}`, cwd: "/Users/you/projects/demo", hook_event_name: "PreToolUse", tool_name: "AskUserQuestion",
    tool_input: {
      questions: [{
        question: "刘海形态默认打开吗？", header: "刘海", multiSelect: false,
        options: [{ label: "默认打开", description: "有刘海的屏自动贴合" }, { label: "默认关闭", description: "要用的人自己打开" }],
      }],
    },
  };
}
