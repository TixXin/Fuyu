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
import type { MediaState } from "../../src/features/media/api";
import type { PluginNotificationsController } from "../../src/features/plugins/usePluginNotifications";
import { checkForUpdate, getUpdateState, reloadPreferences, setAutoCheck, setCheckInterval, setReminderMode, skipVersion } from "../../src/features/updater/updaterController";
import { UPDATE_PREFERENCES_KEY } from "../../src/features/updater/storage";

const automated = new URLSearchParams(location.search).has("test");
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: automated });
async function update(action: () => void | Promise<unknown>) {
  if (automated) await act(async () => { await action(); });
  else await action();
}
const NO_PLUGIN_NOTIFICATIONS: PluginNotificationsController = { notification: null, dismiss: () => {}, runAction: () => {}, post: () => {} };
const UNAVAILABLE_MEDIA: MediaState = {
  available: false, audioActive: false, audioPeak: 0, playbackStatus: "unavailable",
  title: null, artist: null, album: null, thumbnail: null, positionMs: 0, durationMs: 0,
  canSeek: false, canNext: false, canPrevious: false, shuffleActive: null, canShuffle: false,
  repeatMode: "unknown", canRepeat: false, volume: -1, sourceApp: null, activeSessionId: null,
  sessions: [], updatedAt: 0,
};

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
  return <div className="stage" style={{ "--collapsed-island-width": "300px", "--expanded-island-height": "220px", "--expanded-island-width": "460px" } as CSSProperties}>
    <IslandShell deviceUse={{ camera: [], microphone: [] }} qqNotifications={qq} wechatReminders={wechat} qqMail={qqMail} pluginNotifications={NO_PLUGIN_NOTIFICATIONS} preview={null}
      mode={mode} page="todo" isTucked={false} isDetached={true} showTitle={false}
      showCollapsedText={true} collapsedTaskTitle="剩余3个待办" collapsedTodoCount={null} agentSession={null} activeAgentSessionCount={0}
      appearanceMode="classic" nativeGlassState="disabled" agentVisualState="idle" agentStatusLabel="AI Agent 空闲或已完成"
      mediaState={UNAVAILABLE_MEDIA}
      features={{ todo: true, music: false, clipboard: true, shelf: true, qq: false, wechat: false, qqMail: false, agents: false, translation: false }}
      shelfCount={null}
      onOpenPage={() => {}} onOpenMessages={() => {}}
      onPageChange={() => {}} onWindowDragStart={() => {}} onCollapse={() => {}}
      onResetPosition={() => {}} minimizesToTray onMinimize={() => {}} onOpenSettings={() => {}} onOpenTranslator={() => {}} translationPeek={null} onOpenTranslationPeek={() => {}} onTuck={() => {}} onReveal={() => {}} pageDigitModifiers="Alt" hoverSwitchPage={false} hoverSwitchDelayMs={0}>
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
    check(status.querySelector(".update-status__copy strong")?.textContent === "发现新版本 v0.3.4" && status.querySelector(".update-status__copy span")?.textContent === "当前版本 v0.3.3",
      "版本组第一块是状态卡：发现的版本和当前版本");
    const notes = status.querySelector<HTMLButtonElement>(".update-notes__toggle")!;
    check(notes.getAttribute("aria-expanded") === "true" && status.querySelectorAll(".update-notes__item").length === 3 && !status.querySelector(".update-notes__heading"),
      "更新内容默认展开，不重复标题，不列安装包");
    await update(() => notes.click());
    check(notes.getAttribute("aria-expanded") === "false" && !status.querySelector(".update-notes__body"), "更新内容可以收起");
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
    const heroIsland = document.querySelector<HTMLButtonElement>("#settings .about-hero__island")!;
    check(heroIsland.textContent === "有新版本 v0.3.4" && !document.querySelector("#settings .about-hero__status") && document.querySelector("#settings .about-hero__sea"),
      "关于页横幅是海面上的小岛，岛上直接写更新状态，不再另有状态胶囊");
    await update(() => heroIsland.click());
    check(heroIsland.textContent === "谢谢你在用浮屿" && document.querySelector("#settings .about-hero--greeting"), "点小岛，它会打个招呼");
    check(document.querySelector("#settings .about-colophon")?.textContent === "浮屿 v0.3.3 · 以 GPL-3.0 开源 · 用 Tauri 和 React 构建" && document.querySelector("#settings .about-danger .settings-row"),
      "关于页最下面是落款，重置与退出是单独的危险区");
    const version = getUpdateState().nextVersion;
    await update(() => skipVersion(version));
    check(!document.querySelector("#collapsed .island-update-badge"), "跳过这个版本后收起条不再提醒");
    await update(() => skipVersion(null));
    check(document.querySelector("#collapsed .island-update-badge"), "取消跳过后提醒回来");
    await update(() => document.querySelector<HTMLButtonElement>("#settings .settings-sidebar__item[data-category='overview']")!.click());
    const stage = document.querySelector<HTMLElement>("#settings .overview-stage")!;
    const clipboardCard = document.querySelector<HTMLElement>("#settings .settings-overview__feature[data-feature='clipboard']")!;
    await update(() => { clipboardCard.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })); });
    check(stage.dataset.feature === "clipboard" && stage.querySelector(".overview-stage__demo")?.textContent === "已复制 · 会议纪要的第二段",
      "概览：鼠标移到功能卡片上，舞台上的小岛演示这个功能");
    await update(() => { clipboardCard.dispatchEvent(new MouseEvent("mouseout", { bubbles: true })); });
    check(stage.dataset.feature !== undefined && document.querySelectorAll("#settings .settings-overview__tile").length === 3
      && document.querySelectorAll("#settings .settings-overview__next-tile").length === 4 && /^已开 \d+ \/ \d+$/.test(document.querySelector("#settings .settings-overview__count")?.textContent ?? ""),
      "概览：移开后舞台接着轮播开着的功能；常用是三块磁贴，接下来是四块，功能标题旁写开了几个");
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
