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
import { SETTINGS_FOCUS_STORAGE_KEY, aboutTabPage, rememberAboutPage, takeFocusRequest } from "./storage";
import { listenSettingsWindowReopened, showSettingsWindow } from "./api";
import { DEFAULT_SETTINGS, withLayoutFrom, withThemeFrom } from "../../lib/settings/settings";
import { useIslandSettings } from "../../lib/settings/useIslandSettings";
import { useWindowAccent } from "../../lib/theme/useWindowAccent";
import { ResetAppearanceButton } from "./sections/ResetAppearanceButton";
import { useSettingPresets } from "../../lib/settings/useSettingPresets";
import { useSettingsWithBuiltinSwitches } from "../../features/plugin-kernel/useLegacySwitches";
import { useLocale, useTranslation } from "../../i18n";
import { activeTone } from "../../lib/theme/themeMode";
import { useSystemDark } from "../../lib/theme/useResolvedTheme";
import { IconButtonTooltip } from "../../components/IconButtonTooltip";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { useSlotEntries } from "../../features/plugin-kernel/useSlotEntries";
import { categorySlot } from "./slots/categorySlot";
import { settingsRunners } from "../../features/plugin-kernel/settingsSlots";
import { focusSection } from "../../lib/settings/sectionFocus";
import { PluginMarketHeaderActions } from "./PluginMarketHeaderActions";
import { PluginPageActions } from "./PluginPageActions";
import { requestPluginDetail } from "./pluginPageHandoff";
import "./SettingsWindow.css";

const SETTINGS_DARK_FILL = "#131417";
const SETTINGS_LIGHT_FILL = "#eceef2";

export function SettingsWindow() {
  const t = useTranslation();
  const { locale, setLocale } = useLocale();
  const [storedSettings, setSettings, reloadSettings] = useIslandSettings({ coalesceInputFrames: true });
  const settings = useSettingsWithBuiltinSwitches(storedSettings);
  useWindowAccent(settings);
  const systemDark = useSystemDark();
  const presets = useSettingPresets(settings, setSettings);
  const [chosenCategory, setCategory] = useState<SettingsCategory>(DEFAULT_SETTINGS_CATEGORY);
  const unsupported = useUnsupportedFeatures();
  useSlotEntries(categorySlot);
  const category = isCategoryAvailable(chosenCategory, unsupported, isMacOS) ? chosenCategory : DEFAULT_SETTINGS_CATEGORY;
  const features = useFeatureSwitches(settings, setSettings);
  const offFeature = features.hiddenPages.has(category) ? featureOf(category) : undefined;
  const page = offFeature ? null : category;
  useEffect(() => {
    rememberAboutPage(category);
  }, [category]);

  const focusRequestedSection = useCallback(() => {
    const request = takeFocusRequest();
    const section = request?.section ?? null;
    if (request?.plugin) requestPluginDetail(request.plugin, "settings");
    if (section === "savePath") {
      setCategory("todos");
      focusSection(section);
    }
    if (section === "updates") {
      setCategory(aboutTabPage(request?.tab ?? "overview"));
      return;
    }
    const target = section && settingsCategoryFor(section);
    if (!target) return;
    setCategory(target);
    if (target !== section) focusSection(section);
  }, []);

  useEffect(() => {
    void showSettingsWindow().catch((error) => {
      console.error("Failed to show settings window", error);
    });
  }, []);

  useEffect(() => {
    void getCurrentWindow()
      .setTitle(`${t.settings.project.appName} ${t.settings.title}`)
      .catch((error) => {
        console.error("Failed to set settings window title", error);
      });
  }, [t]);

  useEffect(() => {
    focusRequestedSection();

    const syncFocusFromIsland = (event: StorageEvent) => {
      if (event.key === SETTINGS_FOCUS_STORAGE_KEY && event.newValue !== null) {
        focusRequestedSection();
      }
    };

    window.addEventListener("storage", syncFocusFromIsland);
    return () => window.removeEventListener("storage", syncFocusFromIsland);
  }, [focusRequestedSection]);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    const reopened = () => {
      reloadSettings();
      focusRequestedSection();
    };
    void listenSettingsWindowReopened(reopened)
      .then((unlisten) => (cancelled ? unlisten() : (stop = unlisten)))
      .catch((error) => console.error("Failed to listen for the settings window reopening", error));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [focusRequestedSection, reloadSettings]);

  const resetAppearance = useCallback(() => {
    setSettings((current) => withThemeFrom(current, DEFAULT_SETTINGS));
  }, [setSettings]);

  const openShortcuts = () => setCategory("shortcuts");
  const changeCategory = (next: string) => {
    const target = settingsCategoryFor(next);
    if (!target) return;
    setCategory(target);
    if (target !== next) focusSection(next);
  };
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
          category === "theme" || category === "themeStyle"
            ? <ResetAppearanceButton onReset={resetAppearance} />
            : category === "appearance" || category === "appearanceCollapsed"
            ? <ResetAppearanceButton layout onReset={() => setSettings((current) => withLayoutFrom(current, DEFAULT_SETTINGS))} />
            : category === "pluginsV3"
            ? <PluginPageActions onOpenPage={setCategory} />
            : category === "pluginMarket"
            ? <PluginMarketHeaderActions />
            : null
        }
      >
        {offFeature && (
          <FeatureOffPage
            feature={offFeature}
            onEnable={() => features.switches[offFeature].set(true)}
            onOpenOverview={() => changeCategory("overview")}
          />
        )}
        <SlotView
          slot={categorySlot}
          props={{
            settings,
            locale,
            unsupported,
            features: features.switches,
            presets,
            onLocaleChange: setLocale,
            onSettingsChange: setSettings,
            onOpenPage: changeCategory,
            onShowPage: setCategory,
            onOpenShortcuts: openShortcuts,
          }}
          select={(items) => items.filter((item) => item.id === page)}
        />
      </LayoutEditor>
    </main>
  );
}
