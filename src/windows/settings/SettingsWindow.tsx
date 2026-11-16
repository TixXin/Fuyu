import { useCallback, useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { DEFAULT_SETTINGS_CATEGORY, featureOf, isCategoryAvailable, settingsCategoryFor, type SettingsCategory } from "./categories";
import { FeatureOffPage } from "./FeatureOffPage";
import { isMacOS, useUnsupportedFeatures } from "../../lib/platform";
import { useMacWindowKeys } from "./useMacWindowKeys";
import { useFeatureSwitches } from "./useFeatureSwitches";
import { LayoutEditor } from "./LayoutEditor";
import "./slots/categories";
import "./slots/runners";
import { SETTINGS_FOCUS_STORAGE_KEY, takeFocusRequest } from "./storage";
import { showSettingsWindow } from "./api";
import { DEFAULT_SETTINGS, isSameSettings, withLayoutFrom, withThemeFrom } from "../../lib/settings/settings";
import { STORAGE_KEY, loadSettings, saveSettings } from "../../lib/settings/storage";
import { useWindowAccent } from "../../lib/theme/useWindowAccent";
import { ResetAppearanceButton } from "./sections/ResetAppearanceButton";
import type { IslandSettings } from "../../lib/settings/types";
import { useSettingPresets } from "../../lib/settings/useSettingPresets";
import { useLegacySwitches } from "../../features/plugin-kernel/useLegacySwitches";
import { usePluginsV3Enabled } from "./usePluginHostStatus";
import { useMarketInstallRequest } from "../../features/plugins/market-link/useMarketInstallRequest";
import { useLocale, useTranslation } from "../../i18n";
import { activeTone } from "../../lib/theme/themeMode";
import { useSystemDark } from "../../lib/theme/useResolvedTheme";
import { IconButtonTooltip } from "../../components/IconButtonTooltip";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { categorySlot } from "./slots/categorySlot";
import { settingsRunners } from "../../features/plugin-kernel/settingsSlots";
import { focusSection } from "../../lib/settings/sectionFocus";
import "./SettingsWindow.css";

const SETTINGS_DARK_FILL = "#131417";
const SETTINGS_LIGHT_FILL = "#eceef2";

export function SettingsWindow() {
  const t = useTranslation();
  const { locale, setLocale } = useLocale();
  const [storedSettings, setStoredSettings] = useState<IslandSettings>(loadSettings);
  const [settings, setSettings] = useLegacySwitches([storedSettings, setStoredSettings]);
  useWindowAccent(settings);
  const systemDark = useSystemDark();
  const presets = useSettingPresets(settings, setSettings);
  const [chosenCategory, setCategory] = useState<SettingsCategory>(DEFAULT_SETTINGS_CATEGORY);
  const unsupported = useUnsupportedFeatures();
  const pluginsV3 = usePluginsV3Enabled();
  const category = isCategoryAvailable(chosenCategory, unsupported, isMacOS, pluginsV3) ? chosenCategory : DEFAULT_SETTINGS_CATEGORY;
  const features = useFeatureSwitches(settings, setSettings);
  const offFeature = features.hiddenPages.has(category) ? featureOf(category) : undefined;
  const page = offFeature ? null : category;

  const focusRequestedSection = useCallback(() => {
    const section = takeFocusRequest();
    if (section === "savePath") {
      setCategory("todos");
      focusSection(section);
    }
    const target = section && settingsCategoryFor(section);
    if (target) setCategory(target);
  }, []);

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
    saveSettings(storedSettings);
  }, [storedSettings]);

  useEffect(() => {
    focusRequestedSection();

    const syncFromIsland = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        const nextSettings = loadSettings();
        setStoredSettings((current) =>
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
  }, [setSettings]);

  const openShortcuts = () => setCategory("shortcuts");
  const [managedPluginId, setManagedPluginId] = useState<string | null>(null);
  const changeCategory = (next: typeof category) => {
    setManagedPluginId(null);
    setCategory(next);
  };
  const managePlugin = (id: string) => {
    setManagedPluginId(id);
    setCategory("plugins");
  };
  const showMarket = useCallback(() => setCategory("market"), []);
  const marketRequest = useMarketInstallRequest(showMarket);
  useMacWindowKeys();

  const light = activeTone(settings.themeMode, systemDark) === "light";
  useEffect(() => {
    const window = getCurrentWindow();
    const failed = (error: unknown) => console.error("Failed to set the settings window's tone", error);
    if (!isMacOS) void window.setBackgroundColor(light ? SETTINGS_LIGHT_FILL : SETTINGS_DARK_FILL).catch(failed);
    void window.setTheme(light ? "light" : "dark").catch(failed);
  }, [light]);

  return (
    <main className={`settings-stage stage--font-${settings.fontFamily}${isMacOS ? " settings-stage--mac" : ""}${light ? " island-light settings-stage--light" : ""}`}>
      <IconButtonTooltip scope="body" />
      <SlotView slot={settingsRunners} props={{ settings }} />
      <LayoutEditor
        category={category}
        hidden={features.hiddenPages}
        onCategoryChange={changeCategory}
        titleAction={
          category === "theme" ? <ResetAppearanceButton onReset={resetAppearance} />
          : category === "appearance" ? <ResetAppearanceButton layout onReset={() => setSettings((current) => withLayoutFrom(current, DEFAULT_SETTINGS))} />
          : null
        }
      >
        {offFeature && <FeatureOffPage feature={offFeature} onOpenOverview={() => changeCategory("overview")} />}
        <SlotView
          slot={categorySlot}
          props={{
            settings,
            locale,
            unsupported,
            features: features.switches,
            presets,
            managedPluginId,
            marketRequest,
            onLocaleChange: setLocale,
            onSettingsChange: setSettings,
            onOpenPage: changeCategory,
            onShowPage: setCategory,
            onOpenShortcuts: openShortcuts,
            onManagePlugin: managePlugin,
          }}
          select={(items) => items.filter((item) => item.id === page)}
        />
      </LayoutEditor>
    </main>
  );
}
