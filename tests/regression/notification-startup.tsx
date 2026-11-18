import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import { emit } from "@tauri-apps/api/event";
import "../../src/styles/tokens.css";
import { useSourceReconcile } from "../../src/features/messages/plugin/useSourceSwitches";
import { QQNotificationControls, useQQNotifications, type QQNotificationsController } from "../../src/features/messages/qq-notifications/QQNotifications";
import { WeChatReminderControls, useWeChatReminders, type WeChatRemindersController } from "../../src/features/messages/wechat/WeChatReminders";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });
const keys = ["fuyu-qq-notifications-enabled", "fuyu-wechat-reminders-enabled", "fuyu-qq-notification-access-requested"];
const original = keys.map((key) => localStorage.getItem(key));
const messages: string[] = [];
const calls: { command: string; args: Record<string, unknown> }[] = [];
let permission = "allowed";
let revision = 0;
let config: Record<string, unknown> = {};

const plugins = () => [{ id: "messages", kind: "builtin", enabled: true, background: [], config: { ...config } }];
const qqSnapshot = () => ({
  revision: ++revision, enabled: config.qq === true,
  status: config.qq !== true ? "disabled" : permission === "allowed" ? "listening" : permission === "denied" ? "permissionDenied" : "permissionRequired",
  items: [], error: null,
});
const wechatSnapshot = () => ({
  revision: ++revision, enabled: config.wechat === true, status: config.wechat === true ? "listening" : "disabled",
  pending: false, lastAttentionAt: null, error: null, message: null, items: [],
});

function switched(key: string) {
  if (key === "qq") void emit("qq-notifications-changed", { snapshot: qqSnapshot(), newestId: null, windowVisible: true });
  if (key === "wechat") void emit("wechat-reminder-changed", { snapshot: wechatSnapshot(), windowVisible: true });
}
let qq: QQNotificationsController;
let wechat: WeChatRemindersController;
let root: Root | undefined;

mockIPC((command, payload) => {
  const args = (payload ?? {}) as Record<string, unknown>;
  calls.push({ command, args });
  if (command === "request_qq_notification_access") return permission;
  if (command === "get_builtin_plugins") return plugins();
  if (command === "set_builtin_plugin_config") {
    config = { ...config, [String(args.key)]: args.value };
    switched(String(args.key));
    return plugins();
  }
  if (command === "get_qq_notification_state") return qqSnapshot();
  if (command === "set_wechat_expose_ui" || command === "set_wechat_hide_taskbar_button") return wechatSnapshot();
}, { shouldMockEvents: true });

function Fixture() {
  useSourceReconcile();
  qq = useQQNotifications(true);
  wechat = useWeChatReminders(true);
  return <><QQNotificationControls controller={qq} /><WeChatReminderControls controller={wechat} /></>;
}

async function mount() {
  if (root) await act(async () => root!.unmount());
  root = createRoot(document.getElementById("fixture")!);
  await act(async () => { root!.render(<StrictMode><Fixture /></StrictMode>); });
}

async function reset(access: string) {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  keys.forEach((key) => localStorage.removeItem(key));
  calls.length = 0;
  permission = access;
  config = {};
  await act(async () => { await emit("builtin-plugins-changed", plugins()); });
}

async function settled(ready: () => boolean) {
  for (let waited = 0; waited < 2_000 && !ready(); waited += 50) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
  }
}

function check(condition: unknown, label: string) {
  if (!condition) throw new Error(label);
  messages.push(`PASS ${label}`);
}

const requests = () => calls.filter((call) => call.command === "request_qq_notification_access").length;

try {
  await reset("allowed");
  await mount();
  await settled(() => qq!.snapshot.enabled && wechat!.snapshot.enabled && requests() > 0);
  check(qq!.snapshot.enabled && wechat!.snapshot.enabled, "首次启动 QQ 与微信均默认开启");
  check(config.qq === true && config.wechat === true, "首次启动把 QQ、微信的开关按默认值写进插件设置");
  check(requests() === 1, "StrictMode 初始化只请求一次通知访问");
  await mount();
  check(requests() === 1, "后续启动不会重复发起授权请求");

  await act(async () => { await qq!.setEnabled(false); await wechat!.setEnabled(false); });
  await settled(() => !qq!.snapshot.enabled && !wechat!.snapshot.enabled);
  check(config.qq === false && config.wechat === false, "关闭写进插件设置");
  check(keys.slice(0, 2).every((key) => localStorage.getItem(key) === null), "关闭不再镜像回写旧存储键");
  await mount();
  await settled(() => !qq!.busy && !wechat!.busy);
  check(!qq!.snapshot.enabled && !wechat!.snapshot.enabled && requests() === 1, "关闭后重启仍关闭，不申请授权");

  await reset("allowed");
  localStorage.setItem(keys[0], "false");
  localStorage.setItem(keys[1], "false");
  await mount();
  await settled(() => config.qq !== undefined && config.wechat !== undefined);
  check(config.qq === false && config.wechat === false, "升级时旧的关闭偏好迁进插件设置");
  check(!qq!.snapshot.enabled && !wechat!.snapshot.enabled && requests() === 0, "升级保留已有关闭偏好");
  await act(async () => { await qq!.setEnabled(true); });
  await settled(() => qq!.snapshot.enabled && requests() === 1);
  check(qq!.snapshot.enabled && !wechat!.snapshot.enabled && requests() === 1, "重新启用 QQ 不影响微信开关");

  await reset("denied");
  await mount();
  await settled(() => qq!.snapshot.status === "permissionDenied" && !qq!.busy);
  check(qq!.snapshot.enabled && qq!.snapshot.status === "permissionDenied" && !qq!.busy, "拒绝授权后保留接收偏好并显示权限状态");
  await mount();
  check(requests() === 1, "拒绝授权后重启不会重复请求");
  await act(async () => { await qq!.openSettings(); });
  check(calls.some((call) => call.command === "open_qq_notification_settings" && call.args.access === true), "权限被拒时打开对应 Windows 权限设置");

  await reset("unspecified");
  await mount();
  await settled(() => qq!.snapshot.status === "permissionRequired" && requests() === 1);
  await mount();
  await settled(() => !qq!.busy && !wechat!.busy);
  check(requests() === 1 && qq!.snapshot.status === "permissionRequired", "关闭授权弹窗后不重复请求，并保留手动授权入口");
  await act(async () => { await qq!.requestAccess(); });
  check(requests() === 2, "用户可手动重新发起授权");

  document.getElementById("results")!.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
} catch (error) {
  document.getElementById("results")!.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
  console.error(error);
} finally {
  keys.forEach((key, index) => original[index] === null ? localStorage.removeItem(key) : localStorage.setItem(key, original[index]!));
}
