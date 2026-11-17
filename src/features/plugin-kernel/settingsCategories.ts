import type { ComponentType } from "react";
import { Bell, Bot, Brush, CalendarDays, ClipboardList, Compass, Crop, FlaskConical, Gauge, Inbox, Info, Keyboard, Languages, LayoutTemplate, ListTodo, MessageCircle, MessagesSquare, Mic, MousePointerClick, Music, Palette, Plug, Puzzle, Server, ShieldCheck, SlidersHorizontal, Sparkles, Store, Timer, Volume2 } from "lucide-react";
import type { PlatformFeature } from "../../lib/platform.ts";
import { defineSlot, type SettingsCategoryMeta } from "./slots.ts";

export type SettingsGroup = "basics" | "features" | "agents" | "extensions";

export interface CategoryContext {
  unsupported: ReadonlySet<PlatformFeature>;
  mac: boolean;
  pluginsV3: boolean;
}

type BuiltinCategory = SettingsCategoryMeta<CategoryContext, SettingsGroup> & { id: string };

const supports = (feature: PlatformFeature) => ({ unsupported }: CategoryContext) => !unsupported.has(feature);

export const BUILTIN_CATEGORIES = [
  { id: "overview", icon: Compass, group: null },
  { id: "general", icon: SlidersHorizontal, group: "basics", tabs: ["general", "generalData", "generalApi"] },
  { id: "generalData", icon: SlidersHorizontal },
  { id: "generalApi", icon: SlidersHorizontal },
  { id: "appearance", icon: LayoutTemplate, group: "basics", tabs: ["theme", "themeStyle", "appearance", "appearanceCollapsed", "themeMarket"] },
  { id: "theme", icon: Palette, aliases: ["themePresets"] },
  { id: "themeStyle", icon: Sparkles, aliases: ["themeGlass"] },
  { id: "appearanceCollapsed", icon: LayoutTemplate },
  { id: "themeMarket", icon: Brush },
  { id: "behavior", icon: MousePointerClick, group: "basics", tabs: ["behavior", "behaviorTuck", "behaviorQuiet"] },
  { id: "behaviorTuck", icon: MousePointerClick },
  { id: "behaviorQuiet", icon: MousePointerClick },
  { id: "shortcuts", icon: Keyboard, group: "basics", tabs: ["shortcuts", "shortcutsIsland", "shortcutsReference"] },
  { id: "shortcutsIsland", icon: Keyboard },
  { id: "shortcutsReference", icon: Keyboard },
  { id: "todos", icon: ListTodo, group: "features", feature: "todos", aliases: ["todosStorage"] },
  { id: "calendar", icon: CalendarDays, group: "features", feature: "calendar", aliases: ["calendarSources"] },
  { id: "music", icon: Music, group: "features", tabs: ["music", "musicLyrics", "musicLyricsStyle"], feature: "music", available: supports("music") },
  { id: "musicLyrics", icon: Music, feature: "music", available: supports("music") },
  { id: "musicLyricsStyle", icon: Music, feature: "music", available: supports("music") },
  { id: "translation", icon: Languages, group: "features", feature: "translation", available: supports("translation") },
  { id: "clipboard", icon: ClipboardList, group: "features", tabs: ["clipboard", "clipboardHistory", "clipboardLinks", "clipboardSnippets"], feature: "clipboard", available: supports("clipboard") },
  { id: "clipboardHistory", icon: ClipboardList, aliases: ["clipboardData"], feature: "clipboard", available: supports("clipboard") },
  { id: "clipboardLinks", icon: ClipboardList, feature: "clipboard", available: supports("clipboard") },
  { id: "clipboardSnippets", icon: ClipboardList, feature: "clipboard", available: supports("clipboard") },
  { id: "shelf", icon: Inbox, group: "features", feature: "shelf" },
  { id: "screenshot", icon: Crop, group: "features", tabs: ["screenshot", "screenshotRecord"], feature: "screenshot", available: supports("screenshot") },
  { id: "screenshotRecord", icon: Crop, feature: "screenshot", available: ({ unsupported, mac }) => !mac && !unsupported.has("screenshot") },
  { id: "voiceInput", icon: Mic, group: "features", feature: "voiceInput" },
  { id: "behaviorAlerts", icon: Timer, group: "features", tabs: ["timerAlerts", "behaviorAlerts"] },
  { id: "timerAlerts", icon: Timer, aliases: ["timerBreaks"] },
  { id: "messages", icon: MessageCircle, group: "features", tabs: ["messages", "messagesIm", "messagesMail"] },
  { id: "messagesIm", icon: MessageCircle, aliases: ["qq", "wechat"], available: ({ unsupported }) => !unsupported.has("qq") || !unsupported.has("wechat") },
  { id: "messagesMail", icon: MessageCircle, aliases: ["mail"] },
  { id: "agents", icon: Bot, group: "agents", tabs: ["agents", "agentConnect", "agentApprovals"], aliases: ["agentProviders"], feature: "agents" },
  { id: "agentConnect", icon: Plug, feature: "agents", available: supports("agentConnect") },
  { id: "agentApprovals", icon: ShieldCheck, feature: "agents" },
  { id: "agentAppearance", icon: Palette, group: "agents", tabs: ["agentAppearance", "agentSessions", "agentRings"], feature: "agents" },
  { id: "agentSessions", icon: MessagesSquare, feature: "agents" },
  { id: "agentRings", icon: Gauge, feature: "agents" },
  { id: "agentAlerts", icon: Bell, group: "agents", tabs: ["agentAlerts", "sounds", "agentPush"], feature: "agents" },
  { id: "sounds", icon: Volume2, feature: "agents" },
  { id: "agentPush", icon: Bell, feature: "agents" },
  { id: "agentRemote", icon: Server, group: "agents", tabs: ["agentRemote", "agentTunnel"], feature: "agents", available: supports("agentRemote") },
  { id: "agentTunnel", icon: Server, feature: "agents", available: supports("agentRemote") },
  { id: "plugins", icon: Puzzle, group: "extensions", tabs: ["plugins", "pluginsPages", "pluginsUpdates", "pluginsDev"] },
  { id: "pluginsPages", icon: Puzzle },
  { id: "pluginsUpdates", icon: Puzzle },
  { id: "pluginsDev", icon: Puzzle },
  { id: "pluginsV3", icon: FlaskConical, group: "extensions", available: ({ pluginsV3 }) => pluginsV3 },
  { id: "market", icon: Store, group: "extensions" },
  { id: "about", icon: Info, group: null, aliases: ["updates", "aboutHistory", "aboutHelp"] },
] as const satisfies readonly BuiltinCategory[];

type Builtin = (typeof BUILTIN_CATEGORIES)[number];
type WithTabs = Extract<Builtin, { tabs: readonly string[] }>;

export type SettingsCategory = Builtin["id"];
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
