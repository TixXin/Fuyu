import { act, StrictMode, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import { emit } from "@tauri-apps/api/event";
import "../../src/styles/tokens.css";
import "../../src/windows/island/IslandApp";
import { IslandShell } from "../../src/windows/island/IslandShell";
import { useLatestMessagePreview } from "../../src/features/messages/island/useLatestMessagePreview";
import { useIslandBanner } from "../../src/features/messages/island/useIslandBanner";
import { islandHost } from "../../src/windows/island/islandHost";
import { MessageBanner } from "../../src/features/messages/banner/MessageBanner";
import { useQQNotifications } from "../../src/features/messages/qq-notifications/QQNotifications";
import { useWeChatReminders } from "../../src/features/messages/wechat/WeChatReminders";
import { useImSources } from "../../src/features/messages/im-sources/useImSources";
import { useMail } from "../../src/features/messages/mail/MailPanel";
import type { MailSnapshot } from "../../src/features/messages/mail/api";
import { usePluginNotifications } from "../../src/features/messages/island/usePluginNotifications";
import "../../src/features/messages/plugin/services";
import type { MessageNotice } from "../../src/lib/settings/types";
import { deliverNotice } from "../../src/features/messages/plugin/notices";
import { islandNoticesV1 } from "../../src/lib/island-notices/service";
import { windowServices } from "../../src/features/plugin-kernel/services";

const noticeActions: { pluginId: string; action: string }[] = [];
windowServices.get(islandNoticesV1).on("action", (event) => noticeActions.push(event));
import { useFixtureLines } from "./islandLines";
import { useIslandContributed } from "../../src/features/plugin-kernel/useIslandContributions";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });
const automated = new URLSearchParams(location.search).has("test");
async function update(action: () => void | Promise<void>) {
  if (automated) await act(action);
  else await action();
}
const keys = ["fuyu-qq-notifications-enabled", "fuyu-wechat-reminders-enabled", "fuyu-qq-notification-access-requested", "fuyu-qq-mail-settings"];
const originals = keys.map((key) => localStorage.getItem(key));
keys.forEach((key) => localStorage.removeItem(key));
window.addEventListener("beforeunload", () => {
  keys.forEach((key, index) => originals[index] === null ? localStorage.removeItem(key) : localStorage.setItem(key, originals[index]!));
});

let revision = 0;
const commands: { command: string; args: Record<string, unknown> }[] = [];
let mail: MailSnapshot = {
  revision: 0, email: "island-test@qq.com", configured: true, enabled: true, syncing: false,
  status: "connected", unreadCount: 0, items: [], lastSyncedAt: null, error: null,
};
mockIPC((command, payload) => {
  const args = (payload ?? {}) as Record<string, unknown>;
  commands.push({ command, args });
  if (command === "request_qq_notification_access") return "allowed";
  if (command === "get_qq_notification_state") return { revision: ++revision, enabled: true, status: "listening", items: [], error: null };
  if (command === "get_im_sources_state") return [];
  if (command === "open_im_source") {
    const source = String(args.source);
    void emit("im-sources-changed", {
      source,
      snapshot: { source, revision: ++revision, enabled: true, installed: true, status: "listening", items: [], error: null },
      newestId: null,
      windowVisible: true,
    });
    return null;
  }
  if (command === "set_wechat_expose_ui" || command === "set_wechat_hide_taskbar_button") return { revision: ++revision, enabled: true, status: "listening", pending: false, lastAttentionAt: null, error: null };
  if (command === "get_qq_mail_state") return [mail];
  if (command === "read_qq_mail") return { id: args.messageId, content: String(args.messageId).startsWith("otp-mail-") ? "Verification code: 849201" : "本周项目进度已更新", contentType: "text/plain", attachments: [] };
}, { shouldMockEvents: true });

let changeNotice: (notice: MessageNotice) => void;
let openedSource: string | null = null;

function Fixture() {
  const [notice, setNotice] = useState<MessageNotice>("banner");
  changeNotice = setNotice;
  const qq = useQQNotifications(true);
  const wechat = useWeChatReminders(true);
  const qqMail = useMail(true);
  const plugins = usePluginNotifications(true);
  const imSources = useImSources(true);
  const preview = useLatestMessagePreview(qq, wechat, qqMail, plugins, imSources);
  const hasMessagePreview = Boolean(qq.preview || wechat.previewReceivedAt !== null || qqMail.preview || plugins.notification || imSources.previews.length > 0);
  const banner = useIslandBanner({
    messageNotice: notice,
    notices: { preview, hasMessagePreview, qqNotifications: qq, wechatReminders: wechat, qqMail, pluginNotifications: plugins, imSources },
    mode: "collapsed", isTucked: false, quiet: false,
    onOpenMessages: (source) => { openedSource = source; },
    host: islandHost,
  });
  useFixtureLines({ messages: { qq: qq, wechat: wechat, mail: qqMail, plugin: plugins, im: imSources, preview: banner.barPreview, open: (source) => { openedSource = source; } }, agents: null, status: { state: "idle", label: "AI Agent 空闲或已完成" }, todoTitle: "剩余3个待办" });
  const grow = useIslandContributed((state) => state.summaryGrow);
  const stage = {
    "--collapsed-island-width": `${Math.min(520, 300 + (grow?.width ?? 0))}px`,
    ...(grow && grow.height > 38 ? { "--collapsed-island-height": `${grow.height}px` } : {}),
  } as CSSProperties;
  return <div className="stage" style={stage}>
    <IslandShell
      mode="collapsed" page="todo" isTucked={false} isDetached={true} showTitle={false}
      showCollapsedText={true} appearanceMode="classic" nativeGlassState="disabled"
      features={{ todo: true, music: false, clipboard: true, shelf: true, qq: true, wechat: true, qqMail: true, agents: false, translation: false, calendar: false, screenshots: false, timer: false }}
      onOpenPage={() => {}}
      onPageChange={() => {}} onWindowDragStart={() => {}} onCollapse={() => {}}
      onResetPosition={() => {}} minimizesToTray onMinimize={() => {}} onOpenSettings={() => {}} onOpenTranslator={() => {}} onTuck={() => {}} onReveal={() => {}} pageDigitModifiers="Alt" hoverSwitchPage={false} hoverSwitchDelayMs={0}>
      <span>待办清单</span>
    </IslandShell>
    {banner.banner && <MessageBanner banner={banner.banner} bannerRef={banner.bannerRef} onOpen={banner.open} onClose={banner.close} onAction={banner.runAction} />}
  </div>;
}

async function notify(source: "qq" | "wechat" | "qqMail" | "plugin", title = "小林", durationMs = 5_000) {
  const receivedAt = Date.now();
  await update(async () => {
    if (source === "wechat") await emit("wechat-reminder-changed", {
      snapshot: { revision: ++revision, enabled: true, status: "listening", pending: true, lastAttentionAt: revision, error: null, message: null }, windowVisible: true,
    });
    if (source === "qq") await emit("qq-notifications-changed", {
      snapshot: { revision: ++revision, enabled: true, status: "listening", items: [{ id: `qq-${revision}`, title, body: "下午三点一起讨论新项目的设计方案，记得带上之前整理的资料和上周的评审记录。", createdAt: receivedAt }], error: null },
      newestId: `qq-${revision}`, windowVisible: true,
    });
    if (source === "qqMail") {
      mail = { ...mail, revision: ++revision, unreadCount: 1, items: [{ id: `mail-${revision}`, uid: revision, sender: title, subject: "本周项目进度已更新", unread: true, receivedAt }] };
      await emit("qq-mail-changed", { snapshot: mail, newestId: `mail-${revision}`, windowVisible: true });
    }
    if (source === "plugin") deliverNotice({
      pluginId: "dev.test.build", pluginName: { "zh-CN": "构建", en: "Build" }, title, body: "main 分支构建通过", durationMs, actions: [{ id: "open", title: "查看" }, { id: "rerun", title: "重跑" }],
    });
  });
}

const messages: string[] = [];
function check(condition: unknown, label: string) {
  if (!condition) throw new Error(label);
  messages.push(`PASS ${label}`);
}
const banner = () => document.querySelector<HTMLElement>(".message-banner");
const summary = () => document.querySelector<HTMLElement>(".island__summary")!;
const rects = () => commands.filter((entry) => entry.command === "set_island_banner_rect").map((entry) => entry.args.rect);
async function wait(ms: number) {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });
}
async function waitFor(condition: () => boolean, label: string, timeout = 2000) {
  const deadline = performance.now() + timeout;
  while (!condition()) {
    if (performance.now() > deadline) throw new Error(`等待超时：${label}`);
    await wait(30);
  }
}
const results = document.getElementById("results")!;

async function runChecks() {
  try {
    await notify("qq");
    check(banner()?.querySelector(".message-banner__title")?.textContent === "小林", "QQ 消息弹出横幅，写发送人");
    check(banner()!.querySelector(".message-banner__body")?.textContent?.includes("设计方案"), "横幅写消息摘要");
    check(/^\d\d:\d\d$/.test(banner()!.querySelector(".message-banner__time")?.textContent ?? ""), "横幅写到达时间");
    check(banner()!.querySelector(".message-brand-icon--qq"), "横幅带来源图标");
    check(!summary().querySelector(".island-message-preview") && summary().textContent?.includes("剩余3个待办"), "收起条保持正常显示，不同时出一行预览");
    const body = banner()!.querySelector<HTMLElement>(".message-banner__body")!;
    check(body.getBoundingClientRect().height <= 17 * 2 + 1, "摘要最多两行");
    const box = banner()!.getBoundingClientRect();
    const island = document.querySelector(".island")!.getBoundingClientRect();
    check(box.top > island.bottom && Math.abs((box.left + box.right) / 2 - (island.left + island.right) / 2) < 2, "横幅在岛正下方居中");
    await waitFor(() => rects().some((rect) => rect !== null), "原生端收到横幅区域");
    const rect = rects().find((entry) => entry !== null) as { width: number; height: number };
    check(rect.width > 200 && rect.height > 40, "原生端收到横幅的矩形，让它能点");

    await notify("qq", "项目群");
    check(banner()!.querySelector(".message-banner__title")?.textContent === "项目群", "连续到达时显示最新一条");
    check(banner()!.querySelector(".message-banner__more")?.textContent === "另有 1 条", "连续到达合成一张，写另有 N 条");
    await notify("qqMail", "项目组");
    check(banner()!.querySelector(".message-banner__more")?.textContent === "另有 2 条" && banner()!.querySelector(".message-brand-icon--qqMail"), "邮件并入同一张横幅");
    await act(async () => banner()!.querySelector<HTMLButtonElement>(".message-banner__main")!.click());
    await waitFor(() => commands.some((entry) => entry.command === "read_qq_mail"), "打开邮件");
    check(openedSource === "qqMail" && !banner(), "点邮件横幅打开岛内阅读页并收回");
    await waitFor(() => rects().slice(-1)[0] === null, "收回后清掉点击区域");
    check(rects().slice(-1)[0] === null, "横幅收回后原生端清掉它的区域");

    await notify("wechat");
    check(banner()?.querySelector(".message-brand-icon--wechat") && banner()!.querySelector(".message-banner__title")?.textContent === "微信", "微信也弹横幅，写来源");
    check(banner()!.querySelector(".message-banner__body")?.textContent === "有新提醒" && !summary().querySelector(".message-brand-icon--wechat"), "微信横幅只写有新提醒，收起条不再出一行");
    await act(async () => banner()!.querySelector<HTMLButtonElement>(".message-banner__main")!.click());
    await waitFor(() => commands.some((entry) => entry.command === "open_wechat"), "打开微信");
    check(!banner() && openedSource === "qqMail", "点微信横幅打开微信并收回，打开成功时不切到消息页");

    await notify("plugin", "构建完成", 400);
    const actions = [...banner()!.querySelectorAll<HTMLButtonElement>(".message-banner__action")];
    check(actions.map((button) => button.textContent).join(",") === "查看,重跑", "插件通知带上它的按钮");
    await act(async () => actions[1].click());
    check(noticeActions.some((event) => event.pluginId === "dev.test.build" && event.action === "rerun") && !banner(), "点插件按钮运行动作并收回");

    await notify("plugin", "部署完成", 400);
    await act(async () => { await emit("island-banner-hover-changed", true); });
    await wait(700);
    check(banner(), "鼠标停在横幅上时不收回");
    await act(async () => { await emit("island-banner-hover-changed", false); });
    await waitFor(() => !banner(), "离开后按时收回", 1500);
    check(!banner(), "鼠标离开后按时收回");

    await notify("qq", "老王");
    await act(async () => { banner()!.querySelector<HTMLButtonElement>(".message-banner__main")!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })); });
    await waitFor(() => commands.some((entry) => entry.command === "copy_message_text" && String(entry.args.text).includes("设计方案")), "右键复制横幅文本");
    check(banner()?.querySelector(".message-banner__copied")?.textContent === "已复制", "右键横幅复制消息文本并显示已复制反馈");
    await act(async () => banner()!.querySelector<HTMLButtonElement>(".message-banner__close")!.click());
    check(!banner(), "关闭按钮收回横幅");
    await act(async () => banner()?.querySelector<HTMLButtonElement>(".message-banner__main")?.click());
    check(!commands.some((entry) => entry.command === "open_qq"), "关闭不会打开 QQ");

    await update(async () => {
      const receivedAt = Date.now();
      await emit("qq-notifications-changed", {
        snapshot: { revision: ++revision, enabled: true, status: "listening", items: [{ id: `qq-otp-${revision}`, title: "安全中心", body: "您的登录验证码为 356407，5 分钟内有效。", createdAt: receivedAt }], error: null },
        newestId: `qq-otp-${revision}`, windowVisible: true,
      });
    });
    const qqOtpBtn = banner()?.querySelector<HTMLButtonElement>(".message-banner__action");
    check(qqOtpBtn?.textContent === "复制 356407", "含验证码的 QQ 通知横幅显示一键复制按钮");
    await act(async () => qqOtpBtn!.click());
    await waitFor(() => commands.some((entry) => entry.command === "copy_message_text" && entry.args.text === "356407"), "复制 QQ 验证码");
    check(!banner() && !commands.some((entry) => entry.command === "open_qq"), "点横幅复制验证码后收回且不唤起 QQ");

    await update(async () => {
      const receivedAt = Date.now();
      mail = { ...mail, revision: ++revision, unreadCount: 1, items: [{ id: `otp-mail-${revision}`, uid: revision, sender: "GitHub <noreply@github.com>", subject: "[GitHub] Please verify your device", unread: true, receivedAt }] };
      await emit("qq-mail-changed", { snapshot: mail, newestId: `otp-mail-${revision}`, windowVisible: true });
    });
    await waitFor(() => banner()?.querySelector<HTMLButtonElement>(".message-banner__action")?.textContent === "复制 849201", "按需预取邮件正文验证码");
    await act(async () => banner()!.querySelector<HTMLButtonElement>(".message-banner__action")!.click());
    await waitFor(() => commands.some((entry) => entry.command === "copy_message_text" && entry.args.text === "849201"), "复制邮件正文验证码");
    check(!banner(), "点邮件横幅复制验证码后收回");

    const flashId = "telegram:flash:5000";
    const toastId = "telegram:toast:9:1";
    await update(async () => {
      await emit("im-sources-changed", {
        source: "telegram",
        snapshot: { source: "telegram", revision: ++revision, enabled: true, installed: true, status: "listening", items: [{ id: flashId, kind: "flash", title: "Telegram", body: "", createdAt: Date.now() }], error: null },
        newestId: flashId,
        windowVisible: true,
      });
    });
    check(banner()?.querySelector(".message-brand-icon--telegram") && banner()!.querySelector(".message-banner__body")?.textContent === "有新提醒" && !banner()!.querySelector(".message-banner__more"), "Telegram 闪烁兜底先弹出有新提醒横幅");
    await update(async () => {
      await emit("im-sources-changed", {
        source: "telegram",
        snapshot: { source: "telegram", revision: ++revision, enabled: true, installed: true, status: "listening", items: [{ id: toastId, kind: "toast", title: "Alice", body: "登录验证码 731904", createdAt: Date.now() }], error: null },
        newestId: toastId,
        replacedId: flashId,
        windowVisible: true,
      });
    });
    check(banner()?.querySelector(".message-banner__title")?.textContent === "Alice" && !banner()!.querySelector(".message-banner__more") && banner()!.querySelector(".message-banner__action")?.textContent === "复制 731904", "2 秒内到达真实 Toast 时经 replacedId 原位升级横幅且不计为多条");
    await act(async () => banner()!.querySelector<HTMLButtonElement>(".message-banner__main")!.click());
    await waitFor(() => commands.some((entry) => entry.command === "open_im_source" && entry.args.source === "telegram"), "点 Telegram 横幅唤起 Telegram");
    check(!banner(), "点 Telegram 横幅后收回");

    await act(async () => changeNotice("line"));
    await notify("qq", "小张");
    check(!banner(), "一行预览模式不弹横幅");
    await waitFor(() => Boolean(summary().querySelector(".island-message-preview__sender")?.textContent === "小张"), "一行预览");
    check(true, "一行预览模式照旧在收起条显示");

    results.textContent = messages.join("\n");
    results.dataset.result = "passed";
  } catch (error) {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
    console.error(error);
  }
}

await act(async () => { createRoot(document.getElementById("fixture")!).render(<StrictMode><Fixture /></StrictMode>); });
if (automated) await runChecks();
else {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: false });
  for (const [label, action] of [
    ["QQ 消息", () => notify("qq")], ["邮件", () => notify("qqMail", "项目组")], ["微信", () => notify("wechat")],
    ["插件通知", () => notify("plugin", "构建完成")], ["一行预览", () => update(() => changeNotice("line"))], ["横幅", () => update(() => changeNotice("banner"))],
  ] as const) {
    const control = document.createElement("button");
    control.textContent = label;
    control.onclick = () => void action();
    document.getElementById("controls")!.append(control);
  }
  results.textContent = "点按钮看横幅；横幅约 5 秒后收回。";
}
