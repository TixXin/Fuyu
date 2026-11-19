import type { ComponentProps, ComponentType } from "react";
import { AppearanceSettingsPage } from "../AppearanceSettingsPage";
import { BehaviorSettingsPage } from "../BehaviorSettingsPage";
import { ThemeSettingsPage } from "../ThemeSettingsPage";
import { GeneralSettingsPage } from "../GeneralSettingsPage";
import { SyncSettingsPage } from "../SyncSettingsPage";
import { OverviewSettingsPage } from "../OverviewSettingsPage";
import { ShortcutsSettingsPage } from "../ShortcutsSettingsPage";
import { AboutSettingsPage } from "../AboutSettingsPage";
import { PluginsV3SettingsPage } from "../PluginsV3SettingsPage";
import { PluginMarketPage } from "../PluginMarketPage";
import { PluginDiagnosticsPage } from "../PluginDiagnosticsPage";
import { SlotView } from "../../../features/plugin-kernel/SlotView";
import { addSettingsCategory, type SettingsCategory, type SettingsLink, type SettingsPageProps } from "./categorySlot";
import { settingsSections } from "./sectionSlot";
import "./builtinModuleSwitches";
import "./featureSettings";

export type { SettingsPageProps };

type Page = ComponentType<SettingsPageProps>;

const general = (tab: ComponentProps<typeof GeneralSettingsPage>["tab"]): Page =>
  function GeneralPage({ locale, settings, onLocaleChange, onSettingsChange }) {
    return (
      <GeneralSettingsPage
        tab={tab}
        locale={locale}
        settings={settings}
        onLocaleChange={onLocaleChange}
        onSettingsChange={onSettingsChange}
      />
    );
  };

const appearance = (tab: ComponentProps<typeof AppearanceSettingsPage>["tab"]): Page =>
  function AppearancePage({ settings, onSettingsChange }) {
    return <AppearanceSettingsPage tab={tab} settings={settings} onSettingsChange={onSettingsChange} />;
  };

const theme = (tab: ComponentProps<typeof ThemeSettingsPage>["tab"]): Page =>
  function ThemePage({ settings, presets, onSettingsChange }) {
    return <ThemeSettingsPage tab={tab} settings={settings} presets={presets} onSettingsChange={onSettingsChange} />;
  };

const behavior = (tab: ComponentProps<typeof BehaviorSettingsPage>["tab"]): Page =>
  function BehaviorPage({ settings, onSettingsChange, onShowPage }) {
    return <BehaviorSettingsPage tab={tab} settings={settings} onSettingsChange={onSettingsChange} onOpenPageKeys={() => onShowPage("shortcutsIsland")} />;
  };

const shortcuts = (tab: ComponentProps<typeof ShortcutsSettingsPage>["tab"]): Page =>
  function ShortcutsPage({ settings, onSettingsChange, onOpenPage }) {
    return <ShortcutsSettingsPage tab={tab} settings={settings} onSettingsChange={onSettingsChange} onOpenPage={onOpenPage} />;
  };

const about = (tab: ComponentProps<typeof AboutSettingsPage>["tab"]): Page =>
  function AboutPage({ onSettingsChange, onShowPage }) {
    return <AboutSettingsPage tab={tab} onSettingsChange={onSettingsChange} onOpenPage={onShowPage} />;
  };

const localApiSections = settingsSections<{ onOpenPage: (page: SettingsLink) => void }, "generalApi">();

const PAGES: Partial<Record<SettingsCategory, Page>> = {
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
  general: general("general"),
  generalData: general("generalData"),
  generalSync: () => <SyncSettingsPage />,
  generalApi: ({ onOpenPage }) => <SlotView slot={localApiSections} group="generalApi" props={{ onOpenPage }} />,
  behavior: behavior("behavior"),
  behaviorTuck: behavior("behaviorTuck"),
  behaviorAlerts: behavior("behaviorAlerts"),
  appearance: appearance("appearance"),
  appearanceCollapsed: appearance("appearanceCollapsed"),
  theme: theme("theme"),
  themeStyle: theme("themeStyle"),
  shortcuts: shortcuts("shortcuts"),
  shortcutsIsland: shortcuts("shortcutsIsland"),
  shortcutsReference: shortcuts("shortcutsReference"),
  pluginsV3: ({ onShowPage }) => <PluginsV3SettingsPage onOpenPage={onShowPage} />,
  pluginDiagnostics: ({ onShowPage }) => <PluginDiagnosticsPage onOpenPage={onShowPage} />,
  pluginMarket: ({ onShowPage }) => <PluginMarketPage onOpenPage={onShowPage} />,
  about: about("about"),
  aboutChangelog: about("aboutChangelog"),
  aboutPlugins: about("aboutPlugins"),
  aboutHelp: about("aboutHelp"),
};

for (const [id, page] of Object.entries(PAGES)) addSettingsCategory(id as SettingsCategory, page);
