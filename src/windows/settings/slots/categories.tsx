import { createElement, type ComponentProps, type ComponentType, type Dispatch, type SetStateAction } from "react";
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
  page: SettingsCategory;
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

function BehaviorPage({ page, settings, onSettingsChange, onShowPage }: SettingsPageProps) {
  return <BehaviorSettingsPage tab={page as ComponentProps<typeof BehaviorSettingsPage>["tab"]} settings={settings} onSettingsChange={onSettingsChange} onOpenPageKeys={() => onShowPage("shortcutsIsland")} />;
}

function ShortcutsPage({ page, settings, onSettingsChange, onOpenPage }: SettingsPageProps) {
  return <ShortcutsSettingsPage tab={page as ComponentProps<typeof ShortcutsSettingsPage>["tab"]} settings={settings} onSettingsChange={onSettingsChange} onOpenPage={onOpenPage} />;
}

function ClipboardPage({ page, settings, onOpenShortcuts }: SettingsPageProps) {
  return <ClipboardSettingsPage tab={page as ComponentProps<typeof ClipboardSettingsPage>["tab"]} settings={settings} onOpenShortcuts={onOpenShortcuts} />;
}

function MusicPage({ page, settings, onSettingsChange }: SettingsPageProps) {
  return <MusicSettingsPage tab={page as ComponentProps<typeof MusicSettingsPage>["tab"]} settings={settings} onSettingsChange={onSettingsChange} />;
}

function ScreenshotPage({ page, settings, onSettingsChange, onOpenShortcuts }: SettingsPageProps) {
  return <ScreenshotSettingsPage tab={page as ComponentProps<typeof ScreenshotSettingsPage>["tab"]} settings={settings} onSettingsChange={onSettingsChange} onOpenShortcuts={onOpenShortcuts} />;
}

function PluginsPage({ page, settings, managedPluginId, onOpenShortcuts }: SettingsPageProps) {
  return <PluginsSettingsPage tab={page as ComponentProps<typeof PluginsSettingsPage>["tab"]} settings={settings} managedPluginId={managedPluginId} onOpenShortcuts={onOpenShortcuts} />;
}

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
  behavior: BehaviorPage,
  behaviorTuck: BehaviorPage,
  behaviorAlerts: BehaviorPage,
  appearance: ({ settings, onSettingsChange }) => <AppearanceSettingsPage settings={settings} onSettingsChange={onSettingsChange} />,
  theme: ({ settings, presets, onSettingsChange }) => <ThemeSettingsPage settings={settings} presets={presets} onSettingsChange={onSettingsChange} />,
  themeMarket: ({ settings, locale, presets, onSettingsChange }) => (
    <ThemeMarketPage
      settings={settings}
      onSettingsChange={onSettingsChange}
      onSave={(theme, look) => void presets.onImportPreset(JSON.stringify(buildTheme(theme.name[locale], look, new Date())))}
    />
  ),
  shortcuts: ShortcutsPage,
  shortcutsIsland: ShortcutsPage,
  todos: ({ settings, saveDirectory, onSettingsChange }) => (
    <TodosSettingsPage
      settings={settings}
      saveDirectory={saveDirectory}
      onSettingsChange={onSettingsChange}
    />
  ),
  calendar: ({ settings, onSettingsChange }) => <CalendarSettingsPage settings={settings} onSettingsChange={onSettingsChange} />,
  music: MusicPage,
  musicLyrics: MusicPage,
  musicLyricsStyle: MusicPage,
  translation: ({ settings, onSettingsChange, onOpenShortcuts }) => <TranslationSettingsPage settings={settings} onSettingsChange={onSettingsChange} onOpenShortcuts={onOpenShortcuts} />,
  clipboard: ClipboardPage,
  clipboardHistory: ClipboardPage,
  clipboardSnippets: ClipboardPage,
  clipboardData: ClipboardPage,
  shelf: ({ settings, onSettingsChange }) => <ShelfSettingsPage settings={settings} onSettingsChange={onSettingsChange} />,
  screenshot: ScreenshotPage,
  screenshotRecord: ScreenshotPage,
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
  plugins: PluginsPage,
  pluginsPages: PluginsPage,
  pluginsUpdates: PluginsPage,
  pluginsDev: PluginsPage,
  pluginsV3: () => <PluginsV3SettingsPage />,
  market: ({ marketRequest, onManagePlugin }) => (
    <PluginMarketSection onManage={onManagePlugin} requestedId={marketRequest.requestedId} onDismissRequest={marketRequest.dismiss} />
  ),
  about: ({ onSettingsChange }) => <AboutSettingsPage onSettingsChange={onSettingsChange} />,
};

function EntryPage(props: SettingsPageProps) {
  return createElement(PAGES[props.page], props);
}

for (const category of BUILTIN_CATEGORIES) categorySlot.add({ ...category, component: "tabs" in category ? EntryPage : PAGES[category.id] });
