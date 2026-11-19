import type { ComponentType } from "react";
import { Activity, Bell, Blocks, Bot, Cable, CalendarDays, ClipboardList, Compass, Crop, FolderSync, Gauge, Inbox, Info, Keyboard, Languages, LayoutTemplate, ListTodo, MessageCircle, MessagesSquare, Mic, MousePointerClick, Music, Palette, Plug, Server, ShieldCheck, SlidersHorizontal, Sparkles, Store, Timer, Volume2 } from "lucide-react";
import type { PlatformFeature } from "../../lib/platform.ts";
import { defineSlot, type SettingsCategoryMeta } from "./slots.ts";

export type SettingsGroup = "basics" | "features" | "agents" | "extensions";

export interface CategoryContext {
  unsupported: ReadonlySet<PlatformFeature>;
  mac: boolean;
}

type BuiltinCategory = SettingsCategoryMeta<CategoryContext, SettingsGroup> & { id: string };

const supports = (feature: PlatformFeature) => ({ unsupported }: CategoryContext) => !unsupported.has(feature);

export const BUILTIN_CATEGORIES = [
  { id: "overview", icon: Compass, group: null },
  { id: "general", icon: SlidersHorizontal, group: "basics", tabs: ["general", "generalData", "generalSync"] },
  { id: "generalData", icon: SlidersHorizontal },
  { id: "generalSync", icon: FolderSync, aliases: ["sync"] },
  { id: "appearance", icon: LayoutTemplate, group: "basics", tabs: ["theme", "themeStyle", "appearance", "appearanceCollapsed"] },
  { id: "theme", icon: Palette, aliases: ["themePresets", "themeMarket"] },
  { id: "themeStyle", icon: Sparkles, aliases: ["themeGlass"] },
  { id: "appearanceCollapsed", icon: LayoutTemplate },
  { id: "behavior", icon: MousePointerClick, group: "basics", tabs: ["behavior", "behaviorTuck"], aliases: ["behaviorQuiet"] },
  { id: "behaviorTuck", icon: MousePointerClick },
  { id: "shortcuts", icon: Keyboard, group: "basics", tabs: ["shortcuts", "shortcutsIsland", "shortcutsReference"] },
  { id: "shortcutsIsland", icon: Keyboard },
  { id: "shortcutsReference", icon: Keyboard },
  { id: "todos", icon: ListTodo, group: "features", feature: "todos", aliases: ["todosStorage"] },
  { id: "calendar", icon: CalendarDays, group: "features", feature: "calendar", aliases: ["calendarSources"] },
  { id: "music", icon: Music, group: "features", tabs: ["music", "musicLyrics", "musicLyricsStyle"], feature: "music", available: supports("music") },
  { id: "musicLyrics", icon: Music, feature: "music", available: supports("music") },
  { id: "musicLyricsStyle", icon: Music, feature: "music", available: supports("music") },
  { id: "translation", icon: Languages, group: "features", feature: "translation", available: supports("translation") },
  { id: "clipboard", icon: ClipboardList, group: "features", tabs: ["clipboard", "clipboardHistory", "clipboardSnippets"], feature: "clipboard", available: supports("clipboard") },
  { id: "clipboardHistory", icon: ClipboardList, aliases: ["clipboardData", "clipboardLinks"], feature: "clipboard", available: supports("clipboard") },
  { id: "clipboardSnippets", icon: ClipboardList, feature: "clipboard", available: supports("clipboard") },
  { id: "shelf", icon: Inbox, group: "features", feature: "shelf" },
  { id: "screenshot", icon: Crop, group: "features", tabs: ["screenshot", "screenshotRecord"], feature: "screenshot", available: supports("screenshot") },
  { id: "screenshotRecord", icon: Crop, feature: "screenshot", available: ({ unsupported, mac }) => !mac && !unsupported.has("screenshot") },
  { id: "voiceInput", icon: Mic, group: "features", feature: "voiceInput" },
  { id: "behaviorAlerts", icon: Timer, group: "features", tabs: ["timerAlerts", "behaviorAlerts"] },
  { id: "timerAlerts", icon: Timer, aliases: ["timerBreaks"] },
  { id: "messages", icon: MessageCircle, group: "features", tabs: ["messagesIm", "messages"] },
  { id: "messagesIm", icon: MessageCircle, aliases: ["qq", "wechat", "mail", "messagesMail"] },
  { id: "agents", icon: Bot, group: "agents", tabs: ["agents", "agentConnect", "agentApprovals"], aliases: ["agentProviders"], feature: "agents" },
  { id: "agentConnect", icon: Plug, feature: "agents", available: supports("agentConnect") },
  { id: "agentApprovals", icon: ShieldCheck, feature: "agents" },
  { id: "agentAppearance", icon: Palette, group: "agents", tabs: ["agentAppearance", "agentSessions", "agentRings"], feature: "agents" },
  { id: "agentSessions", icon: MessagesSquare, feature: "agents" },
  { id: "agentRings", icon: Gauge, feature: "agents" },
  { id: "agentAlerts", icon: Bell, group: "agents", tabs: ["agentAlerts", "sounds", "agentPush"], feature: "agents" },
  { id: "sounds", icon: Volume2, feature: "agents" },
  { id: "agentPush", icon: Bell, feature: "agents" },
  { id: "agentRemote", icon: Server, group: "agents", aliases: ["agentTunnel"], feature: "agents", available: supports("agentRemote") },
  { id: "pluginsV3", icon: Blocks, group: "extensions" },
  { id: "pluginDiagnostics", icon: Activity, parent: "pluginsV3" },
  { id: "pluginMarket", icon: Store, group: "extensions" },
  { id: "generalApi", icon: Cable, group: "extensions" },
  { id: "about", icon: Info, group: null, tabs: ["about", "aboutChangelog", "aboutPlugins", "aboutHelp"], aliases: ["updates"] },
  { id: "aboutChangelog", icon: Info, aliases: ["aboutHistory"] },
  { id: "aboutPlugins", icon: Blocks },
  { id: "aboutHelp", icon: Info },
] as const satisfies readonly BuiltinCategory[];

type Builtin = (typeof BUILTIN_CATEGORIES)[number];
type WithTabs = Extract<Builtin, { tabs: readonly string[] }>;

export type SettingsCategory = Builtin["id"];
export type SettingsLink = SettingsCategory | "themeMarket";
export type SettingsEntry = WithTabs["id"];
export type TabbedCategory = WithTabs["tabs"][number];
export type SettingsFeature = Extract<Builtin, { feature: string }>["feature"];

export type CategoryMeta = SettingsCategoryMeta<CategoryContext, SettingsGroup, SettingsCategory>;

export function settingsCategoryIcon(id: SettingsCategory) {
  return BUILTIN_CATEGORIES.find((category) => category.id === id)?.icon ?? Compass;
}

export function addSettingsCategory<Props extends object>(id: SettingsCategory, component: ComponentType<Props>, owner?: string): () => void {
  const index = BUILTIN_CATEGORIES.findIndex((category) => category.id === id);
  const slot = defineSlot<Props, CategoryMeta>("settings.category/v1");
  return slot.add({ ...BUILTIN_CATEGORIES[index], order: index - BUILTIN_CATEGORIES.length, component }, owner);
}
