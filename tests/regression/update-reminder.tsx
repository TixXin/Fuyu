import "./updateReminderEnv";
import "./settingsMocks";
import { act, StrictMode, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles/tokens.css";
import "../../src/windows/island/IslandApp";
import { IslandShell } from "../../src/windows/island/IslandShell";
import type { IslandMode } from "../../src/windows/island/types";
import { SettingsWindow } from "../../src/windows/settings/SettingsWindow";
import { requestSettingsFocus } from "../../src/windows/settings/storage";
import { I18nProvider } from "../../src/i18n";
import { useQQNotifications } from "../../src/features/messages/qq-notifications/QQNotifications";
import { useWeChatReminders } from "../../src/features/messages/wechat/WeChatReminders";
import { useMail } from "../../src/features/messages/mail/MailPanel";
import type { PluginNotificationsController } from "../../src/features/messages/island/usePluginNotifications";
import { checkForUpdate, getUpdateState, installUpdate, reloadPreferences, setAutoCheck, setCheckInterval, setReminderMode, skipVersion } from "../../src/features/updater/updaterController";
import { UPDATE_PREFERENCES_KEY } from "../../src/features/updater/storage";
import { failNextUpdaterCall } from "./updateRuntimeMock";
import { useFixtureLines } from "./islandLines";
import { useUpdateContributions } from "../../src/features/updater/plugin/updateIsland";

const automated = new URLSearchParams(location.search).has("test");
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: automated });
async function update(action: () => void | Promise<unknown>) {
  if (automated) await act(async () => { await action(); });
  else await action();
}
const openUpdates = () => {};
const NO_PLUGIN_NOTIFICATIONS: PluginNotificationsController = { notification: null, dismiss: () => {}, runAction: () => {}, post: () => {} };

const savedPreferences = localStorage.getItem(UPDATE_PREFERENCES_KEY);
localStorage.removeItem(UPDATE_PREFERENCES_KEY);
reloadPreferences();
window.addEventListener("beforeunload", () => {
  if (savedPreferences === null) localStorage.removeItem(UPDATE_PREFERENCES_KEY);
  else localStorage.setItem(UPDATE_PREFERENCES_KEY, savedPreferences);
});

function Island({ mode }: { mode: IslandMode }) {
  const qq = useQQNotifications(false);
  const wechat = useWeChatReminders(false);
  const qqMail = useMail(false);
  useUpdateContributions(openUpdates);
  useFixtureLines({ messages: { qq: qq, wechat: wechat, mail: qqMail, plugin: NO_PLUGIN_NOTIFICATIONS, preview: null }, agents: null, status: { state: "idle", label: "AI Agent 空闲或已完成" }, todoTitle: "剩余3个待办" });
  return <div className="stage" style={{ "--collapsed-island-width": "300px", "--expanded-island-height": "220px", "--expanded-island-width": "460px" } as CSSProperties}>
    <IslandShell
      mode={mode} page="todo" isTucked={false} isDetached={true} showTitle={false}
      showCollapsedText={true} appearanceMode="classic" nativeGlassState="disabled"
      features={{ todo: true, music: false, clipboard: true, shelf: true, qq: false, wechat: false, qqMail: false, agents: false, translation: false, calendar: false, screenshots: false, timer: false }}
      onOpenPage={() => {}}
      onPageChange={() => {}} onWindowDragStart={() => {}} onCollapse={() => {}}
      onResetPosition={() => {}} minimizesToTray onMinimize={() => {}} onOpenSettings={() => {}} onOpenTranslator={() => {}} onTuck={() => {}} onReveal={() => {}} pageDigitModifiers="Alt" hoverSwitchPage={false} hoverSwitchDelayMs={0}>
      <span>待办清单</span>
    </IslandShell>
  </div>;
}

const results = document.getElementById("results")!;

async function mount() {
  requestSettingsFocus("updates");
  await update(() => {
    createRoot(document.getElementById("collapsed")!).render(<StrictMode><Island mode="collapsed" /></StrictMode>);
    createRoot(document.getElementById("expanded")!).render(<StrictMode><Island mode="expanded" /></StrictMode>);
    createRoot(document.getElementById("settings")!).render(<StrictMode><I18nProvider><SettingsWindow /></I18nProvider></StrictMode>);
  });
  await update(checkForUpdate);
}

const messages: string[] = [];
function check(condition: unknown, label: string) {
  if (!condition) throw new Error(label);
  messages.push(`PASS ${label}`);
}

async function runChecks() {
  try {
    await mount();
    const badge = document.querySelector<HTMLElement>("#collapsed .island-update-badge");
    check(badge?.getAttribute("aria-label") === "发现新版本 v0.3.4，点击查看", "收起条显示新版本按钮，悬停文字带版本号");
    check(document.querySelector("#expanded .island-settings-button__dot"), "展开后设置按钮带提示圆点");
    const install = [...document.querySelectorAll<HTMLButtonElement>("#settings button")].find((button) => button.textContent?.includes("下载并安装"));
    check(install && !install.disabled, "设置的关于页给出「下载并安装」");
    const status = document.querySelector<HTMLElement>("#settings .update-status")!;
    check(Boolean(status.closest(".about-hero")) && status.querySelector(".update-status__headline")?.textContent === "发现新版本 v0.3.4" && status.querySelector(".update-status__sub span")?.textContent === "当前版本 v0.3.3",
      "名片里的状态胶囊写发现的版本，下面一行是当前版本");
    const whatsNew = document.querySelector<HTMLElement>("#settings .about-whats-new")!;
    const notes = whatsNew.querySelector<HTMLButtonElement>(".update-notes__toggle")!;
    check(Boolean(whatsNew.previousElementSibling?.matches(".about-hero")) && notes.getAttribute("aria-expanded") === "true" && whatsNew.querySelectorAll(".update-notes__item").length === 3 && !whatsNew.querySelector(".update-notes__heading"),
      "有新版本时名片下面展开更新内容：默认展开，不重复标题，不列安装包");
    await update(() => notes.click());
    check(notes.getAttribute("aria-expanded") === "false" && !whatsNew.querySelector(".update-notes__body"), "更新内容可以收起");
    const channels = [...document.querySelectorAll<HTMLButtonElement>("#settings .settings-row .settings-choice__option")];
    check(channels.map((option) => option.getAttribute("aria-pressed")).join() === "true,false" && channels.every((option) => !option.disabled),
      "更新通道是一行分段选择，当前是稳定版");

    const settingsText = () => document.getElementById("settings")!.textContent ?? "";
    check(settingsText().includes("检查频率") && settingsText().includes("更新提醒方式"), "自动检查下面有检查频率和提醒方式");
    check(settingsText().includes("自动更新") && settingsText().includes("自动下载，手动安装"), "自动更新默认是自动下载、手动安装");
    check(settingsText().includes("上次成功检查"), "脚注显示上次成功检查的时间");
    await update(() => setAutoCheck(false));
    check(!settingsText().includes("检查频率") && !settingsText().includes("更新提醒方式"), "关掉自动检查后两行设置收起");
    await update(() => setAutoCheck(true));
    await update(() => setCheckInterval(24));
    await update(() => setReminderMode("notification"));
    const saved = JSON.parse(localStorage.getItem(UPDATE_PREFERENCES_KEY) ?? "{}") as { checkIntervalHours?: number; reminderMode?: string };
    check(saved.checkIntervalHours === 24 && saved.reminderMode === "notification", "检查频率和提醒方式写进偏好");
    const headline = () => document.querySelector("#settings .update-status__headline")?.textContent;
    const statusButton = () => document.querySelector<HTMLButtonElement>("#settings .update-status__row .update-status__button")?.textContent;
    failNextUpdaterCall("install");
    await update(() => installUpdate(undefined, undefined, { skipBackup: true }));
    check(headline() === "安装更新失败" && statusButton() === "重新检查",
      "下载或安装出错时关于页写「安装更新失败」，按钮是「重新检查」");
    failNextUpdaterCall("check");
    await update(() => checkForUpdate());
    check(headline() === "检查更新失败" && statusButton() === "重试", "检查出错时仍写「检查更新失败」，按钮是「重试」");
    await update(() => checkForUpdate());
    check(headline() === "发现新版本 v0.3.4" && Boolean(document.querySelector("#settings .about-hero__emblem")) && !document.querySelector("#settings .about-hero button.about-hero__emblem"),
      "名片是素的：Logo 位不能点，更新状态只在胶囊里");
    check(document.querySelector("#settings .about-colophon")?.textContent === "浮屿 v0.3.3 · 以 AGPL-3.0 开源 · 用 Tauri 和 React 构建 · Logo 征集中，来画一个 →",
      "关于页最下面是落款，Logo 征集挪到落款里");
    check(document.querySelector("#settings .about-page > .about-danger:nth-last-child(2) .settings-row") !== null,
      "重置与退出在概览最底下、落款上面");
    const version = getUpdateState().nextVersion;
    await update(() => skipVersion(version));
    check(!document.querySelector("#collapsed .island-update-badge"), "跳过这个版本后收起条不再提醒");
    await update(() => skipVersion(null));
    check(document.querySelector("#collapsed .island-update-badge"), "取消跳过后提醒回来");
    await update(() => document.querySelector<HTMLButtonElement>("#settings .settings-sidebar__item[data-category='overview']")!.click());
    const stage = document.querySelector<HTMLElement>("#settings .overview-stage")!;
    const clipboardCard = document.querySelector<HTMLElement>("#settings .settings-overview__feature[data-feature='clipboard']")!;
    await update(() => { clipboardCard.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })); });
    check(stage.dataset.feature === "clipboard" && stage.querySelector(".overview-stage__demo")?.textContent === "已复制 · 投喂给 AI 的提示词",
      "概览：鼠标移到功能卡片上，舞台上的小岛演示这个功能");
    await update(() => { clipboardCard.dispatchEvent(new MouseEvent("mouseout", { bubbles: true })); });
    check(stage.dataset.feature !== undefined && document.querySelectorAll("#settings .settings-overview__tile").length === 3
      && document.querySelectorAll("#settings .settings-overview__next-tile").length === 4 && /^已开 \d+ \/ \d+$/.test(document.querySelector("#settings .settings-overview__count")?.textContent ?? ""),
      "概览：移开后舞台接着轮播开着的功能；常用是三块磁贴，接下来是四块，功能标题旁写开了几个");
    const todosCard = document.querySelector<HTMLElement>("#settings .settings-overview__feature[data-feature='todos']")!;
    await update(() => { todosCard.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })); });
    results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
    results.dataset.result = "passed";
  } catch (error) {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
  }
}

if (automated) {
  void runChecks();
} else {
  const again = document.createElement("button");
  again.type = "button";
  again.textContent = "重新开始（清掉「跳过此版本」）";
  again.addEventListener("click", () => {
    localStorage.removeItem(UPDATE_PREFERENCES_KEY);
    location.reload();
  });
  document.getElementById("controls")!.append(again);
  void mount().then(() => { results.textContent = "演示：后台检查发现 v0.3.4。加 ?test=1 运行检查。"; });
}
