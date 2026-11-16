import type { ComponentType, Dispatch, SetStateAction } from "react";
import { Bell, Bot, Brush, CalendarDays, ClipboardList, Compass, Crop, FlaskConical, Inbox, Info, Keyboard, Languages, LayoutTemplate, ListTodo, MessageCircle, MessagesSquare, Mic, MousePointerClick, Music, Palette, Plug, Puzzle, Server, ShieldCheck, SlidersHorizontal, Store, Volume2 } from "lucide-react";
import { defineSlot, type SettingsCategoryMeta } from "../../../features/plugin-kernel/slots.ts";
import type { PlatformFeature } from "../../../lib/platform.ts";
import type { IslandSettings } from "../../../lib/settings/types.ts";
import type { useSettingPresets } from "../../../lib/settings/useSettingPresets.ts";
import type { useMarketInstallRequest } from "../../../features/plugins/market-link/useMarketInstallRequest.ts";
import type { LocaleCode } from "../../../i18n/index.ts";
import type { FeatureSwitches } from "../useFeatureSwitches.ts";

export type SettingsGroup = "basics" | "features" | "agents" | "extensions";

export interface CategoryContext {
  unsupported: ReadonlySet<PlatformFeature>;
  mac: boolean;
  pluginsV3: boolean;
}

type BuiltinCategory = SettingsCategoryMeta<CategoryContext, SettingsGroup> & { id: string };

export interface SettingsPageProps {
  settings: IslandSettings;
  locale: LocaleCode;
  unsupported: ReadonlySet<PlatformFeature>;
  features: FeatureSwitches;
  presets: ReturnType<typeof useSettingPresets>;
  managedPluginId: string | null;
  marketRequest: ReturnType<typeof useMarketInstallRequest>;
  onLocaleChange: (locale: LocaleCode) => void;
  onSettingsChange: Dispatch<SetStateAction<IslandSettings>>;
  onOpenPage: (page: SettingsCategory) => void;
  onShowPage: (page: SettingsCategory) => void;
  onOpenShortcuts: () => void;
  onManagePlugin: (id: string) => void;
}

const supports = (feature: PlatformFeature) => ({ unsupported }: CategoryContext) => !unsupported.has(feature);

export const BUILTIN_CATEGORIES = [
  { id: "overview", icon: Compass, group: null },
  { id: "general", icon: SlidersHorizontal, group: "basics" },
  { id: "behavior", icon: MousePointerClick, group: "basics", tabs: ["behavior", "behaviorTuck", "behaviorAlerts"] },
  { id: "behaviorTuck", icon: MousePointerClick },
  { id: "behaviorAlerts", icon: MousePointerClick },
  { id: "appearance", icon: LayoutTemplate, group: "basics", tabs: ["theme", "appearance", "themeMarket"] },
  { id: "theme", icon: Palette },
  { id: "themeMarket", icon: Brush },
  { id: "shortcuts", icon: Keyboard, group: "basics", tabs: ["shortcuts", "shortcutsIsland"] },
  { id: "shortcutsIsland", icon: Keyboard },
  { id: "todos", icon: ListTodo, group: "features", feature: "todos" },
  { id: "calendar", icon: CalendarDays, group: "features", feature: "calendar" },
  { id: "music", icon: Music, group: "features", tabs: ["music", "musicLyrics", "musicLyricsStyle"], feature: "music", available: supports("music") },
  { id: "musicLyrics", icon: Music, feature: "music", available: supports("music") },
  { id: "musicLyricsStyle", icon: Music, feature: "music", available: supports("music") },
  { id: "translation", icon: Languages, group: "features", feature: "translation", available: supports("translation") },
  { id: "clipboard", icon: ClipboardList, group: "features", tabs: ["clipboard", "clipboardHistory", "clipboardSnippets", "clipboardData"], feature: "clipboard", available: supports("clipboard") },
  { id: "clipboardHistory", icon: ClipboardList, feature: "clipboard", available: supports("clipboard") },
  { id: "clipboardSnippets", icon: ClipboardList, feature: "clipboard", available: supports("clipboard") },
  { id: "clipboardData", icon: ClipboardList, feature: "clipboard", available: supports("clipboard") },
  { id: "shelf", icon: Inbox, group: "features", feature: "shelf" },
  { id: "screenshot", icon: Crop, group: "features", tabs: ["screenshot", "screenshotRecord"], feature: "screenshot", available: supports("screenshot") },
  { id: "screenshotRecord", icon: Crop, feature: "screenshot", available: ({ unsupported, mac }) => !mac && !unsupported.has("screenshot") },
  { id: "voiceInput", icon: Mic, group: "features", feature: "voiceInput" },
  { id: "messages", icon: MessageCircle, group: "features", aliases: ["qq", "wechat", "mail"] },
  { id: "agents", icon: Bot, group: null, tabs: ["agents", "agentSessions", "agentAlerts", "sounds", "agentApprovals", "agentConnect", "agentRemote"], feature: "agents" },
  { id: "agentSessions", icon: MessagesSquare, feature: "agents" },
  { id: "agentAlerts", icon: Bell, feature: "agents" },
  { id: "sounds", icon: Volume2, feature: "agents" },
  { id: "agentApprovals", icon: ShieldCheck, feature: "agents" },
  { id: "agentConnect", icon: Plug, feature: "agents", available: supports("agentConnect") },
  { id: "agentRemote", icon: Server, feature: "agents", available: supports("agentRemote") },
  { id: "plugins", icon: Puzzle, group: "extensions", tabs: ["plugins", "pluginsPages", "pluginsUpdates", "pluginsDev"] },
  { id: "pluginsPages", icon: Puzzle },
  { id: "pluginsUpdates", icon: Puzzle },
  { id: "pluginsDev", icon: Puzzle },
  { id: "pluginsV3", icon: FlaskConical, group: "extensions", available: ({ pluginsV3 }) => pluginsV3 },
  { id: "market", icon: Store, group: "extensions" },
  { id: "about", icon: Info, group: null, aliases: ["updates"] },
] as const satisfies readonly BuiltinCategory[];

type Builtin = (typeof BUILTIN_CATEGORIES)[number];
type WithTabs = Extract<Builtin, { tabs: readonly string[] }>;

export type SettingsCategory = Builtin["id"];
export type SettingsEntry = WithTabs["id"];
export type TabbedCategory = WithTabs["tabs"][number];
export type SettingsFeature = Extract<Builtin, { feature: string }>["feature"];

export type CategoryMeta = SettingsCategoryMeta<CategoryContext, SettingsGroup, SettingsCategory>;

export const categorySlot = defineSlot<SettingsPageProps, CategoryMeta>("settings.category/v1");

export function addSettingsCategory(id: SettingsCategory, component: ComponentType<SettingsPageProps>, owner?: string): () => void {
  const index = BUILTIN_CATEGORIES.findIndex((category) => category.id === id);
  return categorySlot.add({ ...BUILTIN_CATEGORIES[index], order: index - BUILTIN_CATEGORIES.length, component }, owner);
}
