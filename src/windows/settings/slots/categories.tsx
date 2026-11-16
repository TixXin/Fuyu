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

const behavior = (tab: ComponentProps<typeof BehaviorSettingsPage>["tab"]): Page =>
  function BehaviorPage({ settings, onSettingsChange, onShowPage }) {
    return <BehaviorSettingsPage tab={tab} settings={settings} onSettingsChange={onSettingsChange} onOpenPageKeys={() => onShowPage("shortcutsIsland")} />;
  };

const shortcuts = (tab: ComponentProps<typeof ShortcutsSettingsPage>["tab"]): Page =>
  function ShortcutsPage({ settings, onSettingsChange, onOpenPage }) {
    return <ShortcutsSettingsPage tab={tab} settings={settings} onSettingsChange={onSettingsChange} onOpenPage={onOpenPage} />;
  };

const plugins = (tab: ComponentProps<typeof PluginsSettingsPage>["tab"]): Page =>
  function PluginsPage({ settings, managedPluginId, onOpenShortcuts }) {
    return <PluginsSettingsPage tab={tab} settings={settings} managedPluginId={managedPluginId} onOpenShortcuts={onOpenShortcuts} />;
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
  shortcuts: shortcuts("shortcuts"),
  shortcutsIsland: shortcuts("shortcutsIsland"),
  todos: ({ settings, onSettingsChange }) => <TodosSettingsPage settings={settings} onSettingsChange={onSettingsChange} />,
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

const OWNERS: Partial<Record<SettingsCategory, string>> = { todos: TODOS };

for (const [id, page] of Object.entries(PAGES)) addSettingsCategory(id as SettingsCategory, page, OWNERS[id as SettingsCategory]);
