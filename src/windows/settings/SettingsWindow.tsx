import { useCallback, useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AppearanceSettingsPage } from "./AppearanceSettingsPage";
import { BehaviorSettingsPage } from "./BehaviorSettingsPage";
import { ThemeSettingsPage } from "./ThemeSettingsPage";
import { ThemeMarketPage } from "../../features/theme-market/ThemeMarketPage";
import { buildTheme } from "../../features/appearance/theme";
import { DEFAULT_SETTINGS_CATEGORY, type SettingsCategory } from "./categories";
import { GeneralSettingsPage } from "./GeneralSettingsPage";
import { AgentSettingsPage } from "./AgentSettingsPage";
import { AgentAlertsSettingsPage } from "./AgentAlertsSettingsPage";
import { AgentSessionsSettingsPage } from "./AgentSessionsSettingsPage";
import { AgentConnectSettingsPage } from "./AgentConnectSettingsPage";
import { AgentRemoteHostsSettings } from "../../features/agent-status/AgentRemoteHostsSettings";
import { AgentApprovalSettings } from "../../features/agent-status/approvals/AgentApprovalSettings";
import { SoundSettingsSection } from "../../features/agent-status/sounds/SoundSettingsSection";
import { ClipboardSettingsPage } from "./ClipboardSettingsPage";
import { LayoutEditor } from "./LayoutEditor";
import { MusicSettingsPage } from "./MusicSettingsPage";
import { CalendarSettingsPage } from "./CalendarSettingsPage";
import { ShelfSettingsPage } from "./ShelfSettingsPage";
import { ScreenshotSettingsPage } from "./ScreenshotSettingsPage";
import { ShortcutsSettingsPage } from "./ShortcutsSettingsPage";
import { MessagesSettingsPage } from "./MessagesSettingsPage";
import { SETTINGS_FOCUS_STORAGE_KEY, takeFocusRequest } from "./storage";
import { showSettingsWindow } from "./api";
import { TodosSettingsPage } from "./TodosSettingsPage";
import { TranslationSettingsPage } from "./TranslationSettingsPage";
import { DEFAULT_SETTINGS, isSameSettings, withLayoutFrom, withThemeFrom } from "../../features/appearance/settings";
import { STORAGE_KEY, loadSettings, saveSettings } from "../../features/appearance/storage";
import { useWindowAccent } from "../../features/appearance/useWindowAccent";
import { ResetAppearanceButton } from "../../features/appearance/ResetAppearanceButton";
import type { IslandSettings } from "../../features/appearance/types";
import { useSettingPresets } from "../../features/appearance/useSettingPresets";
import { useQQNotifications } from "../../features/messages/qq-notifications/QQNotifications";
import { useWeChatReminders } from "../../features/messages/wechat/WeChatReminders";
import { useSaveDirectorySetting } from "../../features/todos/useSaveDirectorySetting";
import { AboutSettingsPage } from "./AboutSettingsPage";
import { PluginsSettingsPage } from "./PluginsSettingsPage";
import { PluginMarketSection } from "../../features/plugins/PluginMarketSection";
import { useLocale, useTranslation } from "../../i18n";
import { activeTone } from "../../features/appearance/themeMode";
import { useSystemDark } from "../../features/appearance/useResolvedTheme";
import "./SettingsWindow.css";

// Same as .settings-stage and .settings-stage--light in SettingsWindow.css.
const SETTINGS_DARK_FILL = "#131417";
const SETTINGS_LIGHT_FILL = "#eceef2";

export function SettingsWindow() {
  const t = useTranslation();
  const { locale, setLocale } = useLocale();
  const qqNotifications = useQQNotifications(false);
  const wechatReminders = useWeChatReminders(false);
  const [settings, setSettings] = useState<IslandSettings>(loadSettings);
  // The accent being picked shows here at once, before the island saves it.
  useWindowAccent(settings);
  const systemDark = useSystemDark();
  const presets = useSettingPresets(settings, setSettings);
  const saveDirectory = useSaveDirectorySetting();
  const [category, setCategory] = useState<SettingsCategory>(DEFAULT_SETTINGS_CATEGORY);
  const highlightSaveDirectory = saveDirectory.highlight;

  // The island asks for the save path when an export has nowhere to go; it lives on the todos page.
  const focusSavePath = useCallback(() => {
    setCategory("todos");
    highlightSaveDirectory();
  }, [highlightSaveDirectory]);
  // The translation window's settings button opens its page here.
  const focusRequestedSection = useCallback(() => {
    const section = takeFocusRequest();
    if (section === "savePath") focusSavePath();
    if (section === "translation") setCategory("translation");
    if (section === "music") setCategory("music");
    if (section === "calendar") setCategory("calendar");
    if (section === "mail") setCategory("messages");
    if (section === "updates") setCategory("about");
  }, [focusSavePath]);

  // The window opens hidden and is shown once the page has rendered, so it never shows
  // empty. A hidden webview may not run animation frames at all, so then the rendered
  // DOM is enough; otherwise wait two frames (the first runs before its paint).
  useEffect(() => {
    const show = () => {
      void showSettingsWindow().catch((error) => {
        console.error("Failed to show settings window", error);
      });
    };
    if (document.visibilityState === "hidden") {
      show();
      return;
    }
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(show);
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, []);

  useEffect(() => {
    void getCurrentWindow()
      .setTitle(`${t.settings.project.appName} ${t.settings.title}`)
      .catch((error) => {
        console.error("Failed to set settings window title", error);
      });
  }, [t]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    focusRequestedSection();

    const syncFromIsland = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        const nextSettings = loadSettings();
        setSettings((current) =>
          isSameSettings(current, nextSettings) ? current : nextSettings,
        );
      }

      if (event.key === SETTINGS_FOCUS_STORAGE_KEY && event.newValue !== null) {
        focusRequestedSection();
      }
    };

    window.addEventListener("storage", syncFromIsland);
    return () => window.removeEventListener("storage", syncFromIsland);
  }, [focusRequestedSection]);

  const resetAppearance = useCallback(() => {
    setSettings((current) => withThemeFrom(current, DEFAULT_SETTINGS));
  }, []);

  const openShortcuts = () => setCategory("shortcuts");
  // The market's Manage opens that plugin on the Plugins page; any other way there shows the list.
  const [managedPluginId, setManagedPluginId] = useState<string | null>(null);
  const changeCategory = (next: typeof category) => {
    setManagedPluginId(null);
    setCategory(next);
  };
  const managePlugin = (id: string) => {
    setManagedPluginId(id);
    setCategory("plugins");
  };

  // Light or dark as the island is (C33.6): its light tokens (.island-light) and the window's own.
  const light = activeTone(settings.themeMode, systemDark) === "light";
  // The window's own fill (shown while the page loads, and at an edge just uncovered by
  // resizing) and the system's shadow and border follow the same tone as the page.
  useEffect(() => {
    const window = getCurrentWindow();
    const failed = (error: unknown) => console.error("Failed to set the settings window's tone", error);
    void window.setBackgroundColor(light ? SETTINGS_LIGHT_FILL : SETTINGS_DARK_FILL).catch(failed);
    void window.setTheme(light ? "light" : "dark").catch(failed);
  }, [light]);

  return (
    <main className={`settings-stage stage--font-${settings.fontFamily}${light ? " island-light settings-stage--light" : ""}`}>
      <LayoutEditor
        category={category}
        onCategoryChange={changeCategory}
        titleAction={
          category === "theme" ? <ResetAppearanceButton onReset={resetAppearance} />
          : category === "appearance" ? <ResetAppearanceButton layout onReset={() => setSettings((current) => withLayoutFrom(current, DEFAULT_SETTINGS))} />
          : null
        }
      >
        {category === "general" && (
          <GeneralSettingsPage
            locale={locale}
            settings={settings}
            onLocaleChange={setLocale}
            onSettingsChange={setSettings}
          />
        )}
        {category === "behavior" && <BehaviorSettingsPage settings={settings} onSettingsChange={setSettings} onOpenShortcuts={openShortcuts} />}
        {category === "appearance" && <AppearanceSettingsPage settings={settings} onSettingsChange={setSettings} />}
        {category === "theme" && <ThemeSettingsPage settings={settings} presets={presets} onSettingsChange={setSettings} />}
        {category === "themeMarket" && (
          <ThemeMarketPage
            settings={settings}
            onSettingsChange={setSettings}
            // Saved the way an imported theme file is, so it lands among the Theme page's saved themes.
            onSave={(theme, look) => void presets.onImportPreset(JSON.stringify(buildTheme(theme.name[locale], look, new Date())))}
          />
        )}
        {category === "shortcuts" && <ShortcutsSettingsPage settings={settings} onSettingsChange={setSettings} onOpenPage={changeCategory} />}
        {category === "todos" && (
          <TodosSettingsPage
            settings={settings}
            saveDirectory={saveDirectory}
            onSettingsChange={setSettings}
          />
        )}
        {category === "messages" && (
          <MessagesSettingsPage settings={settings} qqNotifications={qqNotifications} wechatReminders={wechatReminders} onSettingsChange={setSettings} />
        )}
        {category === "translation" && <TranslationSettingsPage settings={settings} onSettingsChange={setSettings} onOpenShortcuts={openShortcuts} />}
        {category === "clipboard" && <ClipboardSettingsPage settings={settings} onOpenShortcuts={openShortcuts} />}
        {category === "music" && <MusicSettingsPage settings={settings} onSettingsChange={setSettings} />}
        {category === "shelf" && <ShelfSettingsPage settings={settings} onSettingsChange={setSettings} />}
        {category === "screenshot" && <ScreenshotSettingsPage settings={settings} onSettingsChange={setSettings} />}
        {category === "calendar" && <CalendarSettingsPage settings={settings} onSettingsChange={setSettings} />}
        {category === "agents" && <AgentSettingsPage settings={settings} onSettingsChange={setSettings} onOpenConnect={() => setCategory("agentConnect")} />}
        {category === "agentRemote" && <AgentRemoteHostsSettings />}
        {category === "agentSessions" && <AgentSessionsSettingsPage settings={settings} onSettingsChange={setSettings} />}
        {category === "agentAlerts" && <AgentAlertsSettingsPage settings={settings} onSettingsChange={setSettings} />}
        {category === "sounds" && <SoundSettingsSection />}
        {category === "agentApprovals" && <AgentApprovalSettings />}
        {category === "agentConnect" && <AgentConnectSettingsPage />}
        {category === "plugins" && <PluginsSettingsPage settings={settings} managedPluginId={managedPluginId} onOpenShortcuts={openShortcuts} />}
        {category === "market" && <PluginMarketSection onManage={managePlugin} />}
        {category === "about" && <AboutSettingsPage onSettingsChange={setSettings} />}
      </LayoutEditor>
    </main>
  );
}
