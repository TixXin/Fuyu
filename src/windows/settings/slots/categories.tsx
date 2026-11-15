import type { ComponentProps, ComponentType, Dispatch, SetStateAction } from "react";
import { AppearanceSettingsPage } from "../AppearanceSettingsPage";
import { BehaviorSettingsPage } from "../BehaviorSettingsPage";
import { ThemeSettingsPage } from "../ThemeSettingsPage";
import { ThemeMarketPage } from "../../../features/theme-market/ThemeMarketPage";
import { buildTheme } from "../../../features/appearance/theme";
import { GeneralSettingsPage } from "../GeneralSettingsPage";
import { OverviewSettingsPage } from "../OverviewSettingsPage";
import type { FeatureSwitches } from "../useFeatureSwitches";
import { AgentSettingsPage } from "../AgentSettingsPage";
import { AgentAlertsSettingsPage } from "../AgentAlertsSettingsPage";
import { AgentSessionsSettingsPage } from "../AgentSessionsSettingsPage";
import { AgentConnectSettingsPage } from "../AgentConnectSettingsPage";
import { AgentRemoteHostsSettings } from "../../../features/agent-status/AgentRemoteHostsSettings";
import { AgentApprovalSettings } from "../../../features/agent-status/approvals/AgentApprovalSettings";
import { SoundSettingsSection } from "../../../features/agent-status/sounds/SoundSettingsSection";
import { ClipboardSettingsPage } from "../ClipboardSettingsPage";
import { MusicSettingsPage } from "../MusicSettingsPage";
import { CalendarSettingsPage } from "../CalendarSettingsPage";
import { ShelfSettingsPage } from "../ShelfSettingsPage";
import { ScreenshotSettingsPage } from "../ScreenshotSettingsPage";
import { ShortcutsSettingsPage } from "../ShortcutsSettingsPage";
import { MessagesSettingsPage } from "../MessagesSettingsPage";
import { TodosSettingsPage } from "../TodosSettingsPage";
import { TranslationSettingsPage } from "../TranslationSettingsPage";
import { VoiceInputSettingsPage } from "../VoiceInputSettingsPage";
import type { IslandSettings } from "../../../features/appearance/types";
import type { useSettingPresets } from "../../../features/appearance/useSettingPresets";
import type { QQNotificationsController } from "../../../features/messages/qq-notifications/QQNotifications";
import type { WeChatRemindersController } from "../../../features/messages/wechat/WeChatReminders";
import type { useSaveDirectorySetting } from "../../../features/todos/useSaveDirectorySetting";
import { AboutSettingsPage } from "../AboutSettingsPage";
import { PluginsSettingsPage } from "../PluginsSettingsPage";
import { PluginsV3SettingsPage } from "../PluginsV3SettingsPage";
import { PluginMarketSection } from "../../../features/plugins/PluginMarketSection";
import type { useMarketInstallRequest } from "../../../features/plugins/market-link/useMarketInstallRequest";
import type { LocaleCode } from "../../../i18n";
import type { PlatformFeature } from "../../../lib/platform";
import { BUILTIN_CATEGORIES, categorySlot, type SettingsCategory } from "./categorySlot";

export interface SettingsPageProps {
  settings: IslandSettings;
  locale: LocaleCode;
  unsupported: ReadonlySet<PlatformFeature>;
  features: FeatureSwitches;
  presets: ReturnType<typeof useSettingPresets>;
  saveDirectory: ReturnType<typeof useSaveDirectorySetting>;
  qqNotifications: QQNotificationsController;
  wechatReminders: WeChatRemindersController;
  managedPluginId: string | null;
  marketRequest: ReturnType<typeof useMarketInstallRequest>;
  onLocaleChange: (locale: LocaleCode) => void;
  onSettingsChange: Dispatch<SetStateAction<IslandSettings>>;
  onOpenPage: (page: SettingsCategory) => void;
  onShowPage: (page: SettingsCategory) => void;
  onOpenShortcuts: () => void;
  onManagePlugin: (id: string) => void;
}

type Page = ComponentType<SettingsPageProps>;

const behavior = (tab: ComponentProps<typeof BehaviorSettingsPage>["tab"]): Page =>
  function BehaviorPage({ settings, onSettingsChange, onShowPage }) {
    return <BehaviorSettingsPage tab={tab} settings={settings} onSettingsChange={onSettingsChange} onOpenPageKeys={() => onShowPage("shortcutsIsland")} />;
  };

const shortcuts = (tab: ComponentProps<typeof ShortcutsSettingsPage>["tab"]): Page =>
  function ShortcutsPage({ settings, onSettingsChange, onOpenPage }) {
    return <ShortcutsSettingsPage tab={tab} settings={settings} onSettingsChange={onSettingsChange} onOpenPage={onOpenPage} />;
  };

const clipboard = (tab: ComponentProps<typeof ClipboardSettingsPage>["tab"]): Page =>
  function ClipboardPage({ settings, onOpenShortcuts }) {
    return <ClipboardSettingsPage tab={tab} settings={settings} onOpenShortcuts={onOpenShortcuts} />;
  };

const music = (tab: ComponentProps<typeof MusicSettingsPage>["tab"]): Page =>
  function MusicPage({ settings, onSettingsChange }) {
    return <MusicSettingsPage tab={tab} settings={settings} onSettingsChange={onSettingsChange} />;
  };

const screenshot = (tab: ComponentProps<typeof ScreenshotSettingsPage>["tab"]): Page =>
  function ScreenshotPage({ settings, onSettingsChange, onOpenShortcuts }) {
    return <ScreenshotSettingsPage tab={tab} settings={settings} onSettingsChange={onSettingsChange} onOpenShortcuts={onOpenShortcuts} />;
  };

const plugins = (tab: ComponentProps<typeof PluginsSettingsPage>["tab"]): Page =>
  function PluginsPage({ settings, managedPluginId, onOpenShortcuts }) {
    return <PluginsSettingsPage tab={tab} settings={settings} managedPluginId={managedPluginId} onOpenShortcuts={onOpenShortcuts} />;
  };

const PAGES: Record<SettingsCategory, Page> = {
  overview: ({ settings, locale, features, unsupported, onLocaleChange, onSettingsChange, onOpenPage }) => (
    <OverviewSettingsPage
      settings={settings}
      locale={locale}
      features={features}
      unsupported={unsupported}
      onLocaleChange={onLocaleChange}
      onSettingsChange={onSettingsChange}
      onOpenPage={onOpenPage}
    />
  ),
  general: ({ locale, settings, onLocaleChange, onSettingsChange }) => (
    <GeneralSettingsPage
      locale={locale}
      settings={settings}
      onLocaleChange={onLocaleChange}
      onSettingsChange={onSettingsChange}
    />
  ),
  behavior: behavior("behavior"),
  behaviorTuck: behavior("behaviorTuck"),
  behaviorAlerts: behavior("behaviorAlerts"),
  appearance: ({ settings, onSettingsChange }) => <AppearanceSettingsPage settings={settings} onSettingsChange={onSettingsChange} />,
  theme: ({ settings, presets, onSettingsChange }) => <ThemeSettingsPage settings={settings} presets={presets} onSettingsChange={onSettingsChange} />,
  themeMarket: ({ settings, locale, presets, onSettingsChange }) => (
    <ThemeMarketPage
      settings={settings}
      onSettingsChange={onSettingsChange}
      onSave={(theme, look) => void presets.onImportPreset(JSON.stringify(buildTheme(theme.name[locale], look, new Date())))}
    />
  ),
  shortcuts: shortcuts("shortcuts"),
  shortcutsIsland: shortcuts("shortcutsIsland"),
  todos: ({ settings, saveDirectory, onSettingsChange }) => (
    <TodosSettingsPage
      settings={settings}
      saveDirectory={saveDirectory}
      onSettingsChange={onSettingsChange}
    />
  ),
  calendar: ({ settings, onSettingsChange }) => <CalendarSettingsPage settings={settings} onSettingsChange={onSettingsChange} />,
  music: music("music"),
  musicLyrics: music("musicLyrics"),
  musicLyricsStyle: music("musicLyricsStyle"),
  translation: ({ settings, onSettingsChange, onOpenShortcuts }) => <TranslationSettingsPage settings={settings} onSettingsChange={onSettingsChange} onOpenShortcuts={onOpenShortcuts} />,
  clipboard: clipboard("clipboard"),
  clipboardHistory: clipboard("clipboardHistory"),
  clipboardSnippets: clipboard("clipboardSnippets"),
  clipboardData: clipboard("clipboardData"),
  shelf: ({ settings, onSettingsChange }) => <ShelfSettingsPage settings={settings} onSettingsChange={onSettingsChange} />,
  screenshot: screenshot("screenshot"),
  screenshotRecord: screenshot("screenshotRecord"),
  voiceInput: ({ settings }) => <VoiceInputSettingsPage settings={settings} />,
  messages: ({ settings, qqNotifications, wechatReminders, unsupported, onSettingsChange }) => (
    <MessagesSettingsPage settings={settings} qqNotifications={qqNotifications} wechatReminders={wechatReminders} unsupported={unsupported} onSettingsChange={onSettingsChange} />
  ),
  agents: ({ settings, onSettingsChange, onShowPage }) => <AgentSettingsPage settings={settings} onSettingsChange={onSettingsChange} onOpenConnect={() => onShowPage("agentConnect")} />,
  agentSessions: ({ settings, onSettingsChange }) => <AgentSessionsSettingsPage settings={settings} onSettingsChange={onSettingsChange} />,
  agentAlerts: ({ settings, onSettingsChange }) => <AgentAlertsSettingsPage settings={settings} onSettingsChange={onSettingsChange} />,
  sounds: () => <SoundSettingsSection />,
  agentApprovals: () => <AgentApprovalSettings />,
  agentConnect: () => <AgentConnectSettingsPage />,
  agentRemote: () => <AgentRemoteHostsSettings />,
  plugins: plugins("plugins"),
  pluginsPages: plugins("pluginsPages"),
  pluginsUpdates: plugins("pluginsUpdates"),
  pluginsDev: plugins("pluginsDev"),
  pluginsV3: () => <PluginsV3SettingsPage />,
  market: ({ marketRequest, onManagePlugin }) => (
    <PluginMarketSection onManage={onManagePlugin} requestedId={marketRequest.requestedId} onDismissRequest={marketRequest.dismiss} />
  ),
  about: ({ onSettingsChange }) => <AboutSettingsPage onSettingsChange={onSettingsChange} />,
};

for (const category of BUILTIN_CATEGORIES) categorySlot.add({ ...category, component: PAGES[category.id] });
