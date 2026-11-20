import { act, StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import { emit } from "@tauri-apps/api/event";
import { useImSources } from "../../src/features/messages/im-sources/useImSources";
import { IM_SOURCE_IDS, type ImSourceId, type ImSourceSnapshot } from "../../src/features/messages/im-sources/imSourcesState";
import { useMail, type MailController, sanitizeMailHtml } from "../../src/features/messages/mail/MailPanel";
import type { MailContent, MailSnapshot } from "../../src/features/messages/mail/api";
import type { MessageSource } from "../../src/features/messages/messagePreview";
import { useQQNotifications } from "../../src/features/messages/qq-notifications/QQNotifications";
import { useWeChatReminders } from "../../src/features/messages/wechat/WeChatReminders";
import { MessagesPanel, messagePanelHeight, type MessageView } from "../../src/features/messages/Messages";
import "../../src/windows/island/IslandApp.css";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });
const params = new URLSearchParams(location.search);
const state = params.get("state") ?? "qq";
const now = Date.now();
const keys = ["fuyu-qq-mail-settings", "fuyu-qq-mail-remote-images", "fuyu-qq-notifications-enabled", "fuyu-wechat-reminders-enabled", "fuyu-qq-notification-access-requested"];
const original = keys.map(key => localStorage.getItem(key));
keys.forEach(key => localStorage.removeItem(key));
const calls: { command: string; args: Record<string, unknown> }[] = [];
let revision = 0;
let mail: MailController;
let view: MessageView;
let setView: (source: MessageView) => void;
let setExtraImOn: (on: boolean) => void;
let imItemsBySource: Partial<Record<ImSourceId, ImSourceSnapshot["items"]>> = {};
const BOT_TABLE = [
  "**WebDev 前 20 有变动**",
  "| 排名 | 模型 | 分数 | 变化 |",
  "|---:|---|---:|:---:|",
  ...Array.from({ length: 14 }, (_, index) => `| ${index + 1} | Model-${String.fromCharCode(65 + index)}-Reasoning-Preview | ${1500 - index * 7} | — |`),
  "完整榜单：[WebDev Arena](https://example.com/webdev)",
].join("\n");

const imSnapshotOf = (source: ImSourceId): ImSourceSnapshot => {
  const enabled = sources[source] === true;
  return {
    source,
    revision: ++revision,
    enabled,
    installed: source === "telegram" || source === "feishu",
    status: enabled ? "listening" : "disabled",
    items: enabled ? (imItemsBySource[source] ?? []) : [],
    error: null,
  };
};
let readBehavior = async (id: string): Promise<MailContent> => ({ id, attachments: [], contentType: "text/plain", content: "你好，\n\n本周的开发工作已完成，请查看下面的安排：\n\n1. 周二完成消息界面验收。\n2. 周四讨论下个版本。\n3. 周五汇总反馈。\n\n谢谢。\n产品团队" });
let snapshot: MailSnapshot = {
  revision: ++revision, email: "demo@qq.com", configured: state !== "disconnected", enabled: true, syncing: false,
  status: state === "auth" ? "authRequired" : state === "disconnected" ? "disconnected" : "connected",
  unreadCount: state === "disconnected" ? null : state === "empty" ? 0 : 3, items: state === "empty" || state === "disconnected" ? [] : Array.from({ length: 12 }, (_, index) => ({
    id: `7:${20 - index}`, uid: 20 - index, sender: index === 0 ? "产品团队 <team@example.com>" : `协作团队 ${index}`,
    subject: index === 0 ? "项目周报与下周安排" : `工作进展 ${index}`, receivedAt: now - index * 60_000, unread: index < 3,
  })), lastSyncedAt: now, error: state === "auth" ? "授权码已失效，请重新连接。" : null,
};

let sources: Record<string, unknown> = { qq: true, wechat: true, mail: true };
const plugins = () => [{ id: "messages", kind: "builtin", enabled: true, background: [], config: { ...sources } }];
const wechatSnapshot = () => {
  const on = sources.wechat === true;
  return { revision: ++revision, enabled: on, status: !on ? "disabled" : state === "wechatError" ? "error" : "listening", pending: on && state !== "empty" && state !== "disconnected", lastAttentionAt: !on || state === "empty" || state === "disconnected" ? null : now - 120_000, error: on && state === "wechatError" ? "微信提醒连接失败，正在重试。" : null, message: null, items: [] };
};

mockIPC((command, payload) => {
  const args = (payload ?? {}) as Record<string, unknown>;
  calls.push({ command, args });
  switch (command) {
    case "get_qq_mail_state": return snapshot.configured || snapshot.status !== "disconnected" ? [snapshot] : [];
    case "read_qq_mail": return readBehavior(String(args.messageId));
    case "disconnect_qq_mail": snapshot = { ...snapshot, revision: ++revision, configured: false, enabled: false, status: "disconnected", items: [], unreadCount: null }; return snapshot;
    case "get_qq_mail_reply": return { to: "team@example.com", subject: "Re: 工作进展 2" };
    case "send_qq_mail": return null;
    case "save_qq_mail_attachment": return "C:\\Users\\demo\\Downloads\\季度报告.pdf";
    case "mark_all_qq_mail_read": snapshot = { ...snapshot, revision: ++revision, unreadCount: 0, items: snapshot.items.map(item => ({ ...item, unread: false })) }; return snapshot;
    case "mark_qq_mail_read": snapshot = { ...snapshot, revision: ++revision, unreadCount: Math.max(0, (snapshot.unreadCount ?? 0) - 1), items: snapshot.items.map(item => item.id === args.messageId ? { ...item, unread: false } : item) }; return snapshot;
    case "set_qq_mail_enabled": snapshot = { ...snapshot, revision: ++revision, enabled: Boolean(args.enabled), status: args.enabled ? "connected" : "paused" }; return snapshot;
    case "request_qq_notification_access": return "allowed";
    case "get_qq_notification_state": return { revision: ++revision, enabled: true, status: "listening", error: null, items: state === "empty" || state === "disconnected" ? [] : [{ id: "qq:1", title: "设计讨论组", body: "新版界面已准备好，方便时看一下。", createdAt: now - 30_000 }] };
    case "get_im_sources_state": {
      const target = typeof args.source === "string" ? (args.source as ImSourceId) : null;
      return (target ? [target] : IM_SOURCE_IDS).map(imSnapshotOf);
    }
    case "set_im_source_auto_clear": return imSnapshotOf(String(args.source) as ImSourceId);
    case "clear_im_source_notifications": {
      const source = String(args.source) as ImSourceId;
      imItemsBySource = { ...imItemsBySource, [source]: [] };
      return imSnapshotOf(source);
    }
    case "open_im_source": return null;
    case "request_im_notification_access": return "allowed";
    case "set_wechat_expose_ui": case "set_wechat_hide_taskbar_button": return wechatSnapshot();
    case "get_builtin_plugins": return plugins();
    case "set_builtin_plugin_config":
      sources = { ...sources, [String(args.key)]: args.value };
      if (args.key === "wechat") void emit("wechat-reminder-changed", { snapshot: wechatSnapshot(), windowVisible: false });
      return plugins();
    case "clear_wechat_reminders": return { revision: ++revision, enabled: true, status: "listening", pending: false, lastAttentionAt: now, error: null, message: null, items: [] };
    default: return null;
  }
}, { shouldMockEvents: true });

function Fixture() {
  mail = useMail(false);
  const qqNotifications = useQQNotifications(false);
  const wechatReminders = useWeChatReminders(false);
  const imSources = useImSources(false);
  const [extraIm, setExtraIm] = useState(false);
  setExtraImOn = setExtraIm;
  [view, setView] = useState<MessageView>(["reader", "html", "loading", "error", "auth", "mail", "disconnected"].includes(state) ? "qqMail" : ["wechat", "wechatError"].includes(state) ? "wechat" : "qq");
  const height = messagePanelHeight(view, mail.wantsTallPanel);
  const enabledSources: Partial<Record<MessageSource, boolean>> & Pick<Record<MessageSource, boolean>, "qq" | "wechat" | "qqMail"> = {
    qq: true,
    wechat: true,
    qqMail: true,
    ...(extraIm ? Object.fromEntries(IM_SOURCE_IDS.map((id) => [id, true])) : {}),
  };
  return <section className="message-fixture" style={{ height }}><header className="fixture-heading">fuyu<span>消息</span></header><div className="message-panel"><MessagesPanel source={view} enabledSources={enabledSources} onSourceChange={next => { mail.closeReader(); setView(next); }} onOpenMailSettings={() => calls.push({ command: "open_mail_settings", args: {} })} qqMail={mail} qqNotifications={qqNotifications} wechatReminders={wechatReminders} imSources={imSources} /></div></section>;
}

const root = createRoot(document.getElementById("fixture")!);
const messages: string[] = [];
function check(condition: unknown, label: string) { if (!condition) throw new Error(label); messages.push(`PASS ${label}`); }
const button = (label: string) => {
  const result = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).filter(item => item.getAttribute("aria-label") === label || item.textContent === label);
  if (result.length !== 1) throw new Error(`Expected one button ${label}, got ${result.length}`);
  return result[0];
};
const click = async (label: string) => { await act(async () => { button(label).click(); }); };
const until = async (ready: () => boolean) => {
  for (let tries = 0; tries < 40 && !ready(); tries += 1) await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
};
const type = async (field: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), "value")!.set!;
  await act(async () => { setter.call(field, value); field.dispatchEvent(new Event("input", { bubbles: true })); });
};
const deferred = () => {
  let resolve!: (value: MailContent) => void;
  const promise = new Promise<MailContent>(done => { resolve = done; });
  return { promise, resolve };
};

try {
  await act(async () => { root.render(<StrictMode><Fixture /></StrictMode>); });
  if (params.get("run") === "1") {
    check(view! === "qq" && document.querySelector('.message-sources')?.textContent?.replace(/\d/g, "") === "QQ微信邮箱", "恢复 QQ、微信、邮箱三项品牌导航");
    check(!document.querySelector('.wechat-reminder-card, .message-overview') && !document.querySelector('button[aria-label="消息总览"]'), "微信没有被抽成独立卡片或总览");
    check(document.querySelector<HTMLElement>('.message-fixture')?.style.height === "350px", "列表恢复截图中的固定面板高度");
    await click("微信提醒");
    check(view! === "wechat" && document.querySelector('.wechat-reminder-state--pending') && document.querySelector('.qq-panel__header button[aria-label="打开微信"]'), "微信标签沿用同一行导航和图标工具栏");
    await click("打开微信");
    check(calls.some(call => call.command === "open_wechat"), "微信标签沿用已有唤回命令");
    const chat = { chat: "session_item_lin", contact: "小林", preview: "下午三点开会", unread: 2, at: now };
    await act(async () => {
      await emit("wechat-reminder-changed", { windowVisible: true, snapshot: {
        revision: ++revision, enabled: true, status: "listening", pending: true, lastAttentionAt: now, error: null, message: chat,
        items: [{ at: now, message: chat, reason: null }, { at: now - 60_000, message: null, reason: "tray" }],
      } });
    });
    const wechatRows = () => [...document.querySelectorAll<HTMLElement>('[aria-label="微信提醒列表"] .qq-panel__item')];
    check(wechatRows().length === 2 && wechatRows()[0].textContent?.includes("小林") && wechatRows()[0].textContent?.includes("下午三点开会"), "微信页像 QQ 页一样逐条列出联系人和消息");
    check(wechatRows()[1].textContent?.includes("有新提醒") && wechatRows()[1].textContent?.includes("托盘"), "没读到内容的提醒也占一行，并写明原因");
    await click("打开微信：小林");
    check(calls.some(call => call.command === "open_wechat" && call.args.chat === "session_item_lin"), "点一行打开那个聊天");
    check(document.querySelector(".message-sources .message-source-dot"), "有新提醒时「微信」标签上有点");
    await click("清空微信提醒");
    check(calls.some(call => call.command === "clear_wechat_reminders") && wechatRows().length === 0 && !document.querySelector('.wechat-reminder-state--pending')
      && !document.querySelector(".message-sources .message-source-dot"), "清空后提醒列表、提醒状态和「微信」标签上的点都没了");
    await click("接收微信提醒");
    await until(() => button("接收微信提醒").getAttribute("aria-checked") === "false");
    check(document.querySelector('.qq-panel__empty')?.textContent?.includes("已暂停") && document.querySelector('button[aria-label="接收微信提醒"]')?.getAttribute("aria-checked") === "false", "暂停微信提醒后保持正确状态");
    await click("接收微信提醒");
    await until(() => button("接收微信提醒").getAttribute("aria-checked") === "true");
    await click("QQ 通知");
    check(view! === "qq" && document.querySelector('[aria-label="QQ 最近通知"]'), "切回 QQ 显示自己的通知列表");
    await click("复制内容");
    check(calls.some(call => call.command === "copy_message_text" && call.args.text === "新版界面已准备好，方便时看一下。") && !calls.some(call => call.command === "open_qq") && Boolean(document.querySelector('button[aria-label="已复制"]')), "QQ 通知项可单独复制正文且不唤起 QQ");

    const fixtureBox = document.querySelector<HTMLElement>(".message-fixture")!;
    fixtureBox.style.width = "350px";
    imItemsBySource = {
      telegram: [
        { id: "telegram:toast:1:1", kind: "toast", title: "Alice", body: "构建包已通过验收", createdAt: now - 5_000 },
        { id: "telegram:flash:2", kind: "flash", title: "Telegram", body: "", createdAt: now - 15_000 },
        { id: "telegram:badge:3", kind: "badge", title: "Telegram", body: "", createdAt: now - 25_000, unread: 4 },
        { id: "telegram:toast:4:1", kind: "toast", title: "榜单机器人", body: BOT_TABLE, createdAt: now - 35_000 },
      ],
    };
    sources = { ...sources, ...Object.fromEntries(IM_SOURCE_IDS.map((id) => [id, true])) };
    await act(async () => {
      setExtraImOn(true);
      await emit("im-sources-changed", { source: "telegram", snapshot: imSnapshotOf("telegram"), newestId: "telegram:toast:1:1", windowVisible: true });
    });
    const navBar = document.querySelector<HTMLDivElement>(".message-sources")!;
    const qqPanelEl = document.querySelector<HTMLElement>(".qq-panel")!;
    const qqHeaderEl = document.querySelector<HTMLElement>(".qq-panel__header")!;
    const areBrandIconsReady = () =>
      IM_SOURCE_IDS.every((id) => {
        const img = document.querySelector<HTMLImageElement>(`.message-brand-icon--${id}`);
        return Boolean(img && img.complete && img.naturalWidth > 0);
      });
    await until(areBrandIconsReady);
    check(areBrandIconsReady(), "7 个新来源官方品牌图标全部成功加载");
    check(
      qqPanelEl.scrollWidth <= qqPanelEl.clientWidth + 1
        && qqHeaderEl.scrollWidth <= qqHeaderEl.clientWidth + 1
        && navBar.scrollWidth > navBar.clientWidth,
      "350px 窄面板同时开启 10 个来源时顶栏可横向滚动且面板不溢出",
    );
    await act(async () => { navBar.dispatchEvent(new WheelEvent("wheel", { deltaY: 80, bubbles: true })); });
    check(navBar.scrollLeft > 0, "鼠标滚轮可横向滚动多来源标签栏");
    await click("企业微信通知");
    check(view! === "wecom" && document.querySelector("[aria-label='企业微信最近通知']"), "切换到最右侧的企业微信来源并显示对应面板");
    await click("Telegram 通知");
    const tgItems = () => [...document.querySelectorAll<HTMLElement>("[aria-label='最近收到的 Telegram 通知'] .qq-panel__item")];
    check(
      tgItems().length === 4
        && tgItems()[0].textContent?.includes("Alice")
        && tgItems()[0].textContent?.includes("构建包已通过验收")
        && Boolean(tgItems()[0].querySelector(".qq-panel__copy"))
        && tgItems()[1].textContent?.includes("有新提醒")
        && !tgItems()[1].querySelector(".qq-panel__copy")
        && tgItems()[2].textContent?.includes("4 条未读")
        && !tgItems()[2].querySelector(".qq-panel__copy"),
      "通用 IM 面板兼容展示 Toast 正文、闪烁有新提醒与未读数条目",
    );
    const bot = tgItems()[3];
    const table = bot.querySelector<HTMLElement>(".message-body .markdown__table");
    check(bot.querySelectorAll("tbody tr").length === 14 && bot.querySelectorAll("thead th").length === 4 && !bot.textContent?.includes("|---"), "机器人发的 Markdown 表格按行列显示");
    check(table && table.scrollWidth > table.clientWidth && qqPanelEl.scrollWidth <= qqPanelEl.clientWidth + 1, "宽表格在卡片里横向滚动，不撑宽面板");
    const toggle = bot.querySelector<HTMLButtonElement>(".message-body__toggle");
    check(toggle?.textContent === "展开全文" && bot.querySelector<HTMLElement>(".message-body__clip")!.scrollHeight > bot.querySelector<HTMLElement>(".message-body__clip")!.clientHeight, "长消息先折起，有「展开全文」");
    await act(async () => { toggle!.click(); });
    check(toggle!.getAttribute("aria-expanded") === "true" && toggle!.textContent === "收起", "点「展开全文」看到整条");
    await act(async () => { bot.querySelector<HTMLAnchorElement>('a[href="https://example.com/webdev"]')!.click(); });
    check(calls.some((call) => call.command === "plugin:opener|open_url" && call.args.url === "https://example.com/webdev") && !calls.some((call) => call.command === "open_im_source"), "点正文里的链接只打开链接，不唤起应用");
    calls.splice(0, calls.length, ...calls.filter((call) => call.command !== "plugin:opener|open_url"));
    await click("打开 Telegram：Alice");
    check(calls.some((call) => call.command === "open_im_source" && call.args.source === "telegram"), "点击 IM 通知项唤起对应应用");
    await click("清空岛内 Telegram 通知");
    check(calls.some((call) => call.command === "clear_im_source_notifications" && call.args.source === "telegram") && tgItems().length === 0, "清空 IM 来源通知列表");
    sources = { qq: true, wechat: true, mail: true };
    fixtureBox.style.width = "";
    await act(async () => {
      setExtraImOn(false);
      await emit("im-sources-changed", { source: "telegram", snapshot: imSnapshotOf("telegram"), newestId: null, windowVisible: false });
      setView("qq");
    });

    await click("邮箱");
    const list = document.querySelector<HTMLDivElement>('.qq-mail-list')!;
    list.scrollTop = 120;
    list.dispatchEvent(new Event("scroll", { bubbles: true }));
    const scrollBefore = list.scrollTop;
    const pending = deferred();
    readBehavior = () => pending.promise;
    await click("阅读邮件：项目周报与下周安排，未读");
    check(view! === "qqMail" && mail!.reading && document.querySelector('[aria-label="邮件阅读"]'), "点击邮件在岛内打开阅读页并显示加载状态");
    check(!calls.some(call => call.command === "plugin:opener|open_url"), "点邮件不会打开浏览器");
    check(document.activeElement?.getAttribute("aria-label") === "邮件正文", "阅读页接收键盘焦点");
    await act(async () => { pending.resolve({ id: "7:20", attachments: [], contentType: "text/html", content: '<h2>下周安排</h2><p>保留正文</p><script>window.readerPwned=true</script><img src="https://tracking.example.com/pixel" onerror="alert(1)"><iframe src="https://tracking.example.com/"></iframe><form><input></form><style>body{display:none}</style><a href="javascript:alert(1)">危险链接</a><a href="https://example.com/report">查看周报</a><table><tr><td>会议</td><td>周二</td></tr></table>' }); await pending.promise; });
    const body = document.querySelector(".qq-mail-body")!;
    check(body.textContent?.includes("保留正文") && !body.querySelector("script,iframe,form,input,style,svg"), "HTML 正文保留排版并去除脚本和嵌入内容");
    check(!body.querySelector("img") && document.querySelector(".qq-mail-remote")?.textContent?.includes("已阻止 1 张远程图片"), "远程图片默认不加载并提示被拦数量");
    await click("显示图片");
    const remoteImage = body.querySelector("img");
    check(remoteImage?.getAttribute("src") === "https://tracking.example.com/pixel" && remoteImage.getAttribute("referrerpolicy") === "no-referrer" && !remoteImage.hasAttribute("onerror"), "允许后远程图片保留但禁止外发 referrer 并剔除事件属性");
    check(!document.querySelector(".qq-mail-remote") && localStorage.getItem("fuyu-qq-mail-remote-images") === "true", "放行后隐藏提示并记住开关选择");
    check(!body.querySelector('a[href^="javascript"]'), "邮件不能执行危险链接");
    check(!Reflect.get(window, "readerPwned"), "邮件脚本没有执行");
    const reportLink = body.querySelector<HTMLAnchorElement>('a[href="https://example.com/report"]')!;
    check(getComputedStyle(document.querySelector(".qq-mail-reader__subject")!).userSelect === "text" && getComputedStyle(document.querySelector(".qq-mail-reader__meta")!).userSelect === "text", "阅读页标题和发件人允许框选复制");
    await click("复制正文");
    check(calls.some(call => call.command === "copy_message_text" && String(call.args.text).includes("保留正文") && !String(call.args.text).includes("<h2")), "阅读页工具栏可一键复制净化后的纯文本正文");
    await act(async () => { reportLink.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 120, clientY: 120 })); });
    check(Boolean(document.querySelector(".qq-mail-link-menu")), "右键正文链接弹出复制链接菜单");
    await click("复制链接地址");
    check(!document.querySelector(".qq-mail-link-menu") && calls.some(call => call.command === "copy_message_text" && call.args.text === "https://example.com/report") && !calls.some(call => call.command === "plugin:opener|open_url"), "复制链接地址写入剪贴板且不打开浏览器");
    await act(async () => { root.render(<StrictMode><Fixture /></StrictMode>); });
    check(reportLink.isConnected, "重新渲染不重写正文，按住的链接不会被换掉（issue #18）");
    await act(async () => { reportLink.click(); });
    check(calls.some(call => call.command === "plugin:opener|open_url" && call.args.url === "https://example.com/report"), "正文中的网页链接通过系统浏览器打开");
    check(mail!.snapshot.unreadCount === 3 && mail!.snapshot.items[0].unread, "阅读保持未读状态和角标数量");
    await click("返回列表");
    check(view! === "qqMail" && !mail!.selectedMail && document.querySelector<HTMLDivElement>('.qq-mail-list')!.scrollTop === scrollBefore, "返回邮箱列表并保留滚动位置");
    check((document.activeElement as HTMLElement)?.dataset.mailId === "7:20", "返回列表时恢复原邮件的键盘焦点");

    await click("邮箱");
    readBehavior = async id => ({ id, attachments: [], contentType: "text/plain", content: '<img src=x onerror=alert(1)>\n纯文本邮件\n您的登录验证码为 618402，5 分钟内有效。' });
    await click("阅读邮件：项目周报与下周安排，未读");
    check(document.querySelector(".qq-mail-body--text")?.textContent?.includes("<img") && !document.querySelector(".qq-mail-body img"), "纯文本邮件按文字显示，不解释为 HTML");
    check(document.querySelector(".qq-mail-otp__value")?.textContent === "618402", "阅读页识别出正文中的验证码并显示胶囊条");
    await click("复制验证码 618402");
    check(calls.some(call => call.command === "copy_message_text" && call.args.text === "618402"), "点击阅读页验证码复制按钮把验证码写入剪贴板");
    await act(async () => { sources = { ...sources, otpCopy: false }; await emit("builtin-plugins-changed", plugins()); });
    check(!document.querySelector(".qq-mail-otp"), "关闭识别验证码开关后隐藏阅读页验证码胶囊条");
    await act(async () => { sources = { ...sources, otpCopy: true }; await emit("builtin-plugins-changed", plugins()); });
    check(document.querySelector(".qq-mail-otp__value")?.textContent === "618402", "重新开启后恢复显示验证码胶囊条");
    await click("返回列表");
    check(view! === "qqMail", "从邮箱列表进入后返回邮箱列表");
    check((document.activeElement as HTMLElement)?.dataset.mailId === "7:20", "返回邮箱列表时恢复原邮件的键盘焦点");

    readBehavior = async () => { throw new Error("网络中断，请重试。"); };
    await click("阅读邮件：项目周报与下周安排，未读");
    check(document.querySelector('[role="alert"]')?.textContent?.includes("网络中断"), "正文失败保留标题和当前位置并允许重试");
    readBehavior = async id => ({ id, attachments: [], contentType: "text/plain", content: "恢复后的正文" });
    await click("重试");
    check(document.querySelector(".qq-mail-body")?.textContent === "恢复后的正文", "重试恢复正文");
    await click("返回列表");

    const stale = deferred();
    readBehavior = () => stale.promise;
    await click("阅读邮件：项目周报与下周安排，未读");
    await click("返回列表");
    readBehavior = async id => ({ id, attachments: [], contentType: "text/plain", content: "第二封正文" });
    await click("阅读邮件：工作进展 1，未读");
    await act(async () => { stale.resolve({ id: "7:20", attachments: [], contentType: "text/plain", content: "过期的第一封正文" }); await stale.promise; });
    check(mail!.selectedMail?.id === "7:19" && mail!.content?.content === "第二封正文", "快速返回和切换后，旧请求不会覆盖当前邮件");

    await click("返回列表");
    readBehavior = async id => ({ id, attachments: [{ part: "2", name: "季度报告.pdf", size: 2_150_400, mime: "application/pdf" }], contentType: "text/plain", content: "第三封正文" });
    await click("阅读邮件：工作进展 2，未读");
    check(!calls.some(call => call.command === "mark_qq_mail_read"), "只是阅读不会把邮件标为已读");
    await click("标为已读");
    check(calls.some(call => call.command === "mark_qq_mail_read" && call.args.email === "demo@qq.com" && call.args.messageId === "7:18")
      && ![...document.querySelectorAll("button")].some(button => button.textContent === "标为已读")
      && mail!.snapshot.unreadCount === 2,
      "标为已读发给这封邮件所在的邮箱，之后按钮消失、未读数减一");
    const attachmentRow = document.querySelector(".qq-mail-attachment");
    check(document.querySelector(".qq-mail-attachments__title")?.textContent === "附件（1）"
      && attachmentRow?.textContent?.includes("季度报告.pdf") && attachmentRow.textContent.includes("2.1 MB"),
      "阅读页列出附件的名称和大小");
    await click("保存 · 季度报告.pdf");
    check(calls.some(call => call.command === "save_qq_mail_attachment" && call.args.email === "demo@qq.com" && call.args.messageId === "7:18" && call.args.part === "2")
      && document.querySelector('.qq-mail-attachment button')?.textContent === "已保存",
      "保存附件发给这封邮件的这个分段，完成后显示已保存");

    await click("回复");
    const compose = () => document.querySelector<HTMLElement>(".qq-mail-compose");
    const field = (label: string) => [...compose()!.querySelectorAll("label")].find((item) => item.querySelector("span")?.textContent === label)!.querySelector("input")!;
    check(compose() && field("收件人").value === "team@example.com" && field("主题").value === "Re: 工作进展 2" && mail!.wantsTallPanel,
      "回复从服务器读出的发件人和 Re: 主题开始，面板保持阅读时的高度");
    await type(compose()!.querySelector("textarea")!, "收到，谢谢。");
    await click("发送");
    const replied = calls.find(call => call.command === "send_qq_mail");
    const sent = replied?.args.mail as { to: string[]; subject: string; body: string } | undefined;
    check(replied?.args.email === "demo@qq.com" && replied.args.replyTo === "7:18" && sent?.to.join() === "team@example.com" && sent.body === "收到，谢谢。" && !compose(),
      "回复带上原邮件的标识发出，发送后回到阅读页");
    await click("返回列表");

    await click("写邮件");
    await type(field("收件人"), "a@163.com， b@126.com");
    await type(field("主题"), "周会");
    await click("发送");
    const sends = calls.filter(call => call.command === "send_qq_mail");
    const written = sends[sends.length - 1];
    const writtenMail = written?.args.mail as { to: string[]; subject: string } | undefined;
    check(writtenMail?.to.join() === "a@163.com,b@126.com" && writtenMail.subject === "周会" && written?.args.replyTo === null && !compose(),
      "写邮件按逗号拆分收件人，不是回复，发送后回到列表");

    const markAll = () => document.querySelector<HTMLButtonElement>('.qq-panel__toolbar button[aria-label^="这个邮箱全部标为已读"]');
    check(markAll() && !markAll()!.disabled, "邮箱工具栏有「全部标为已读」，有未读时可点");
    await click(markAll()!.getAttribute("aria-label")!);
    check(calls.some(call => call.command === "mark_all_qq_mail_read" && call.args.email === "demo@qq.com")
      && mail!.snapshot.unreadCount === 0 && !document.querySelector(".qq-mail-unread-dot") && markAll()!.disabled,
      "全部标为已读只发给当前邮箱，之后没有未读圆点、按钮变灰");

    const late = deferred();
    readBehavior = () => late.promise;
    await act(async () => { void mail!.readMail(mail!.snapshot.items[0]); });
    await act(async () => { snapshot = { ...snapshot, revision: ++revision, configured: false, status: "disconnected", enabled: false, items: [], unreadCount: null }; await emit("qq-mail-changed", { snapshot, newestId: null, windowVisible: true }); });
    await act(async () => { late.resolve({ id: "7:20", attachments: [], contentType: "text/plain", content: "断开后的敏感正文" }); await late.promise; });
    check(!mail!.selectedMail && !mail!.content && !document.body.textContent?.includes("断开后的敏感正文"), "断开连接后清空正文并忽略在途结果");
    const sanitized = sanitizeMailHtml('<svg><a href="javascript:alert(1)">x</a></svg><p style="background:url(https://tracking.example.com)">safe</p><img src="https://cdn.example.com/a.png" onerror="alert(1)" width="40"><img src="cid:inline@example"><img src="data:image/png;base64,iVBORw0KGgo=">', { allowRemoteImages: true });
    check(!/style=|javascript:|<svg/i.test(sanitized), "清理器剔除脚本、SVG 与内联样式");
    check(/src="https:\/\/cdn\.example\.com\/a\.png"/.test(sanitized) && /referrerpolicy="no-referrer"/.test(sanitized), "允许后远程图片保留并禁止外发 referrer");
    check(!/cid:|onerror/i.test(sanitized), "cid 引用和事件属性不会被保留");
    check(/src="data:image\/png;base64,iVBORw0KGgo="/.test(sanitized), "内嵌图片的 data URI 保留");
    const blocked = sanitizeMailHtml('<p>正文</p><img src="https://cdn.example.com/a.png"><img src="data:image/png;base64,iVBORw0KGgo=">');
    check(!/cdn\.example\.com/.test(blocked) && /data:image\/png/.test(blocked) && /正文/.test(blocked), "默认拦下远程图片但保留正文和内嵌图片");
    const tables = sanitizeMailHtml('<table><thead><tr><th>项目</th><th>进度</th></tr></thead><tbody><tr><td>前端</td><td>80%</td></tr></tbody></table><table><tr><td>图表</td></tr><tr><td>布局</td><td>格</td></tr></table>');
    check(tables.split('data-mail-table="data"').length === 2 && /<table data-mail-table="data">/.test(tables), "只有首行表头的数据表保留网格，图表与布局表不画灰格子");
    document.documentElement.dataset.testResult = "passed";
  } else if (["reader", "html", "loading", "error"].includes(state)) {
    if (state === "loading") readBehavior = () => new Promise(() => {});
    if (state === "error") readBehavior = async () => { throw new Error("无法加载邮件正文，请检查网络并重试。"); };
    if (state === "html") readBehavior = async id => ({ id, attachments: [], contentType: "text/html", content: '<h2>下周工作安排</h2><p>你好，以下是本周确认的计划：</p><table><tr><th>时间</th><th>事项</th></tr><tr><td>周二 14:00</td><td>消息界面验收</td></tr><tr><td>周四 10:00</td><td>下一版本讨论</td></tr></table><p>完整细节见<a href="https://example.com/report">项目周报</a>。</p><blockquote>请在周三之前补充反馈，谢谢。</blockquote>' });
    await act(async () => { void mail!.readMail(mail!.snapshot.items[0]); });
  }
} catch (error) {
  document.documentElement.dataset.testResult = "failed";
  messages.push(`FAIL ${String(error)}`);
  console.error(error);
} finally {
  keys.forEach((key, index) => { if (original[index] === null) localStorage.removeItem(key); else localStorage.setItem(key, original[index]!); });
  document.getElementById("results")!.textContent = messages.length ? messages.join("\n") : "组件预览 · 模拟数据";
}
