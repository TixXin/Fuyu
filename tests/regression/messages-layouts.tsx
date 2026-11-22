import { act, StrictMode, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import { emit } from "@tauri-apps/api/event";
import "../../src/styles/tokens.css";
import { MESSAGE_LAYOUTS, type MessageLayout } from "../../src/features/messages/feed/messageLayout";
import { useImSources } from "../../src/features/messages/im-sources/useImSources";
import { IM_SOURCE_IDS, type ImSourceId, type ImSourceSnapshot } from "../../src/features/messages/im-sources/imSourcesState";
import { useMail, type MailController } from "../../src/features/messages/mail/MailPanel";
import type { MailSnapshot } from "../../src/features/messages/mail/api";
import { MessagesPanel, messagePanelHeight } from "../../src/features/messages/Messages";
import { setMessageLayout, useMessageLayout } from "../../src/features/messages/plugin/useSourceSwitches";
import { useQQNotifications } from "../../src/features/messages/qq-notifications/QQNotifications";
import { useWeChatReminders } from "../../src/features/messages/wechat/WeChatReminders";
import "../../src/windows/island/IslandApp.css";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });
const params = new URLSearchParams(location.search);
const state = params.get("state") ?? "full";
const test = params.get("test") === "1";
const startLayout = params.get("layout");
const width = Number(params.get("width")) || 560;
const light = params.get("theme") === "light";
const now = Date.now();
const keys = ["fuyu-message-handled", "fuyu-qq-mail-settings", "fuyu-qq-notifications-enabled", "fuyu-wechat-reminders-enabled", "fuyu-qq-notification-access-requested"];
const original = keys.map((key) => localStorage.getItem(key));
keys.forEach((key) => localStorage.removeItem(key));
const calls: { command: string; args: Record<string, unknown> }[] = [];
let revision = 0;
let mail: MailController;
const empty = state === "empty";

let mailbox: MailSnapshot = {
  revision: ++revision, email: "demo@qq.com", configured: true, enabled: true, syncing: false, status: "connected", unreadCount: empty ? 0 : 2, lastSyncedAt: now, error: null,
  items: empty ? [] : [
    { id: "7:30", uid: 30, sender: "GitHub", subject: "您的验证码是 849201", receivedAt: now - 60_000, unread: true },
    { id: "7:29", uid: 29, sender: "产品团队", subject: "项目周报与下周安排", receivedAt: now - 2 * 3_600_000, unread: true },
    { id: "7:28", uid: 28, sender: "协作团队", subject: "已归档的进展", receivedAt: now - 5 * 3_600_000, unread: false },
  ],
};
const qqItems = empty ? [] : [
  { id: "qq:1", title: "设计讨论组", body: "新版界面已准备好，方便时看一下。", createdAt: now - 30_000 },
  { id: "qq:2", title: "设计讨论组", body: "顺便把深色模式也截个图", createdAt: now - 90_000 },
  { id: "qq:3", title: "阿杰", body: "周末去爬山吗？", createdAt: now - 26 * 3_600_000 },
];
const lin = { chat: "session_item_lin", contact: "小林", preview: "下午三点开会，记得带电脑", unread: 2, at: now - 20_000 };
const wechatItems = empty ? [] : [
  { at: lin.at, message: lin, reason: null },
  { at: now - 40 * 60_000, message: null, reason: "tray" },
];
const telegram = empty ? [] : [{ id: "telegram:toast:1:1", kind: "toast", title: "Alice", body: "构建包已通过验收", createdAt: now - 5 * 60_000 }];

let sources: Record<string, unknown> = { qq: true, wechat: true, mail: true, telegram: true, ...(startLayout ? { layout: startLayout } : {}) };
const plugins = () => [{ id: "messages", kind: "builtin", enabled: true, background: [], config: { ...sources } }];
const qqSnapshot = (on = true) => ({ revision: ++revision, enabled: on, status: on ? "listening" : "disabled", error: null, items: on ? qqItems : [] });
const wechatSnapshot = () => ({ revision: ++revision, enabled: true, status: "listening", pending: wechatItems.length > 0, lastAttentionAt: wechatItems.length ? lin.at : null, error: null, message: wechatItems.length ? lin : null, items: wechatItems });
const imSnapshot = (source: ImSourceId): ImSourceSnapshot => {
  const on = source === "telegram";
  return { source, revision: ++revision, enabled: on, installed: on, status: on ? "listening" : "disabled", items: on ? telegram as ImSourceSnapshot["items"] : [], error: null };
};

mockIPC((command, payload) => {
  const args = (payload ?? {}) as Record<string, unknown>;
  calls.push({ command, args });
  switch (command) {
    case "get_qq_mail_state": return [mailbox];
    case "read_qq_mail": return { id: String(args.messageId), attachments: [], contentType: "text/plain", content: "您的验证码是 849201，十分钟内有效。" };
    case "mark_qq_mail_read": mailbox = { ...mailbox, revision: ++revision, items: mailbox.items.map((item) => item.id === args.messageId ? { ...item, unread: false } : item) }; return mailbox;
    case "mark_all_qq_mail_read": mailbox = { ...mailbox, revision: ++revision, unreadCount: 0, items: mailbox.items.map((item) => ({ ...item, unread: false })) }; return mailbox;
    case "get_qq_notification_state": return qqSnapshot();
    case "request_qq_notification_access": return "allowed";
    case "get_im_sources_state": return (typeof args.source === "string" ? [args.source as ImSourceId] : IM_SOURCE_IDS).map(imSnapshot);
    case "set_wechat_expose_ui": case "set_wechat_hide_taskbar_button": return wechatSnapshot();
    case "get_wechat_reminder_state": return wechatSnapshot();
    case "get_builtin_plugins": return plugins();
    case "set_builtin_plugin_config": sources = { ...sources, [String(args.key)]: args.value }; return plugins();
    default: return null;
  }
}, { shouldMockEvents: true });

function Fixture() {
  mail = useMail(false);
  const qqNotifications = useQQNotifications(false);
  const wechatReminders = useWeChatReminders(false);
  const imSources = useImSources(false);
  const layout = useMessageLayout();
  const height = messagePanelHeight("qqMail", mail.wantsTallPanel);
  return (
    <section className={light ? "message-fixture island-light" : "message-fixture"} style={{ height, width, ...(light ? { background: "#f7f7f9", "--island-background-color": "#f7f7f9" } : {}) } as CSSProperties}>
      <header className="fixture-heading">fuyu<span>消息</span></header>
      <div className="message-panel">
        <MessagesPanel source="qq" layout={layout} enabledSources={{ qq: true, wechat: true, qqMail: true, telegram: true }} onSourceChange={() => mail.closeReader()} onOpenMailSettings={() => calls.push({ command: "open_mail_settings", args: {} })} qqMail={mail} qqNotifications={qqNotifications} wechatReminders={wechatReminders} imSources={imSources} />
      </div>
    </section>
  );
}

const root = createRoot(document.getElementById("fixture")!);
const messages: string[] = [];
function check(condition: unknown, label: string) { if (!condition) throw new Error(label); messages.push(`PASS ${label}`); }
const until = async (ready: () => boolean) => {
  for (let tries = 0; tries < 40 && !ready(); tries += 1) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
};
const $ = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector);
const press = async (element: Element | null | undefined) => { if (!element) throw new Error("missing element"); await act(async () => { (element as HTMLElement).click(); }); };
const focusKey = (index: number) => document.querySelectorAll<HTMLButtonElement>(".focus-key")[index];
const cardTitle = () => $(".focus-card__title")?.textContent ?? "";
const shell = () => $(".feed-shell");
const switchTo = async (layout: MessageLayout) => {
  await act(async () => { await setMessageLayout(layout); });
  await until(() => shell()?.dataset.layout === layout);
};
const fits = () => {
  const box = $(".feed-shell")!;
  return box.scrollWidth <= box.clientWidth + 1;
};

try {
  await act(async () => { root.render(<StrictMode><Fixture /></StrictMode>); });
  await until(() => Boolean(shell()) && (empty || Boolean(mail?.mailboxes.length)) && (empty || cardTitle().length > 0 || startLayout !== null));
  if (test) {
    check(shell()?.dataset.layout === "focus", "没设过布局时默认是「一次一条」");
    await until(() => cardTitle().includes("小林"));
    check(cardTitle().includes("小林") && $(".focus-card")?.textContent?.includes("下午三点开会"), "卡片上是最新的一条未读：微信小林");
    await press(focusKey(3));
    check(!calls.some((call) => call.command === "clear_wechat_reminders") && cardTitle().includes("设计讨论组"), "点「已读」换到下一条，不清空微信提醒");
    check(JSON.parse(localStorage.getItem("fuyu-message-handled") ?? "[]").includes(`wechat:${lin.at}`), "聊天的已读记在岛上，重开还在");
    check($(".focus-card__progress")?.textContent?.startsWith("2 / 8"), "进度算上这一轮已经看过的");
    await act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "s" })); });
    const queueRows = () => [...document.querySelectorAll<HTMLButtonElement>(".focus-queue__item")];
    check(cardTitle().includes("GitHub") && queueRows().slice(-1)[0]?.textContent?.includes("设计讨论组"), "按 S 稍后再看：这条排到队尾，换下一条");
    check($(".focus-card__otp")?.getAttribute("aria-label") === "849201", "验证码邮件把数字单独放大显示");
    await press(focusKey(1));
    check(calls.some((call) => call.command === "copy_message_text" && call.args.text === "849201"), "有验证码时「复制」只复制验证码");
    await until(() => !focusKey(1)?.textContent?.includes("已复制"));
    await press(focusKey(0));
    await until(() => Boolean($(".qq-mail-reader")));
    check(calls.some((call) => call.command === "read_qq_mail" && call.args.messageId === "7:30") && $(".qq-mail-reader"), "邮件点「打开」在岛上读正文");
    await act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: " " })); });
    check(!calls.some((call) => call.command === "mark_qq_mail_read"), "读邮件时按空格不会动藏起来的卡片");
    await press($(".qq-mail-back"));
    check(cardTitle().includes("GitHub") && queueRows().slice(-1)[0]?.textContent?.includes("设计讨论组"), "读完返回还在同一张卡，稍后的顺序没丢");
    await press(queueRows().find((row) => row.textContent?.includes("阿杰")));
    check(cardTitle().includes("阿杰"), "点右边「接下来」里的一条直接跳过去");

    await press($('button[aria-label^="消息页布局"]'));
    await press([...document.querySelectorAll('[role="menuitem"]')].find((item) => item.textContent?.includes("时间轴")));
    await until(() => shell()?.dataset.layout === "timeline");
    check(calls.some((call) => call.command === "set_builtin_plugin_config" && call.args.key === "layout" && call.args.value === "timeline") && shell()?.dataset.layout === "timeline", "岛上换布局写进消息插件配置并立刻生效");

    for (const layout of MESSAGE_LAYOUTS) {
      await switchTo(layout);
      check(shell()?.dataset.layout === layout && Boolean($(".feed-layout")) && fits(), `${layout}：渲染出来，560px 下没有横向溢出`);
    }
    $<HTMLElement>(".message-fixture")!.style.width = "350px";
    for (const layout of MESSAGE_LAYOUTS) {
      await switchTo(layout);
      check(fits(), `${layout}：350px 窄面板也不溢出`);
    }
    await switchTo("reader");
    await press($(".reader-item"));
    check(!$(".reader-list")?.offsetParent && $(".reader-detail__back")?.offsetParent, "窄面板的三栏点开一条只显示详情，带返回");
    await press($(".reader-detail__back"));
    check($(".reader-list")?.offsetParent && !$(".reader-pane")?.offsetParent, "返回后回到列表");
    $<HTMLElement>(".message-fixture")!.style.width = `${width}px`;

    await switchTo("inbox");
    await press($(".inbox-layout__read-all"));
    check(calls.some((call) => call.command === "mark_all_qq_mail_read" && call.args.email === "demo@qq.com") && !calls.some((call) => /^clear_/.test(call.command)), "「全部已读」邮件真标已读，聊天只在岛上标记、不清空");
    await switchTo("focus");
    await until(() => Boolean($(".feed-empty")));
    check($(".feed-empty h4")?.textContent === "都看完了", "全部看完后「一次一条」显示都看完了");

    await act(async () => { await emit("qq-notifications-changed", { snapshot: qqSnapshot(false), newestId: null, windowVisible: true }); });
    await until(() => Boolean($('.feed-notice[data-status="off"]')));
    const notice = $('.feed-notice[data-status="off"]');
    check(notice?.textContent?.includes("QQ") && notice.textContent.includes("已关闭"), "关掉的来源在顶上说一句");
    await press(notice?.querySelector("button"));
    check(calls.some((call) => call.command === "set_builtin_plugin_config" && call.args.key === "qq" && call.args.value === true), "点「打开」重新接收这个来源");
    document.documentElement.dataset.testResult = "passed";
  }
} catch (error) {
  document.documentElement.dataset.testResult = "failed";
  messages.push(`FAIL ${String(error)}`);
  console.error(error);
} finally {
  keys.forEach((key, index) => { if (original[index] === null) localStorage.removeItem(key); else localStorage.setItem(key, original[index]!); });
  document.getElementById("results")!.textContent = messages.length ? messages.join("\n") : "组件预览 · 模拟数据";
}
