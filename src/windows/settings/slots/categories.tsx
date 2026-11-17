import type { ComponentProps, ComponentType } from "react";
import { AppearanceSettingsPage } from "../AppearanceSettingsPage";
import { BehaviorSettingsPage } from "../BehaviorSettingsPage";
import { ThemeSettingsPage } from "../ThemeSettingsPage";
import { GeneralSettingsPage } from "../GeneralSettingsPage";
import { OverviewSettingsPage } from "../OverviewSettingsPage";
import { ShortcutsSettingsPage } from "../ShortcutsSettingsPage";
import { TodosSettingsPage } from "../TodosSettingsPage";
import { AboutSettingsPage } from "../AboutSettingsPage";
import { PluginsSettingsPage } from "../PluginsSettingsPage";
import { PluginsV3SettingsPage } from "../PluginsV3SettingsPage";
import { PluginMarketSection } from "../../../features/plugins/PluginMarketSection";
import { OWNER as TODOS } from "../../../features/todos/plugin/owner.ts";
import { addSettingsCategory, type SettingsCategory, type SettingsPageProps } from "./categorySlot";
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

const todos = (tab: ComponentProps<typeof TodosSettingsPage>["tab"]): Page =>
  function TodosPage({ settings, onSettingsChange }) {
    return <TodosSettingsPage tab={tab} settings={settings} onSettingsChange={onSettingsChange} />;
  };

const plugins = (tab: ComponentProps<typeof PluginsSettingsPage>["tab"]): Page =>
  function PluginsPage({ settings, managedPluginId, onOpenShortcuts }) {
    return <PluginsSettingsPage tab={tab} settings={settings} managedPluginId={managedPluginId} onOpenShortcuts={onOpenShortcuts} />;
  };

const about = (tab: ComponentProps<typeof AboutSettingsPage>["tab"]): Page =>
  function AboutPage({ onSettingsChange }) {
    return <AboutSettingsPage tab={tab} onSettingsChange={onSettingsChange} />;
  };

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
  behavior: behavior("behavior"),
  behaviorTuck: behavior("behaviorTuck"),
  behaviorQuiet: behavior("behaviorQuiet"),
  behaviorAlerts: behavior("behaviorAlerts"),
  appearance: appearance("appearance"),
  appearanceCollapsed: appearance("appearanceCollapsed"),
  theme: theme("theme"),
  themeStyle: theme("themeStyle"),
  themeGlass: theme("themeGlass"),
  themePresets: theme("themePresets"),
  shortcuts: shortcuts("shortcuts"),
  shortcutsIsland: shortcuts("shortcutsIsland"),
  shortcutsReference: shortcuts("shortcutsReference"),
  todos: todos("todos"),
  todosStorage: todos("todosStorage"),
  plugins: plugins("plugins"),
  pluginsPages: plugins("pluginsPages"),
  pluginsUpdates: plugins("pluginsUpdates"),
  pluginsDev: plugins("pluginsDev"),
  pluginsV3: () => <PluginsV3SettingsPage />,
  market: ({ marketRequest, onManagePlugin }) => (
    <PluginMarketSection onManage={onManagePlugin} requestedId={marketRequest.requestedId} onDismissRequest={marketRequest.dismiss} />
  ),
  about: about("about"),
  aboutHistory: about("aboutHistory"),
  aboutHelp: about("aboutHelp"),
};

const OWNERS: Partial<Record<SettingsCategory, string>> = { todos: TODOS, todosStorage: TODOS };

for (const [id, page] of Object.entries(PAGES)) addSettingsCategory(id as SettingsCategory, page, OWNERS[id as SettingsCategory]);
