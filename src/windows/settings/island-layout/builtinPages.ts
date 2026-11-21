import { Bot, Languages, MessageCircle, type LucideIcon } from "lucide-react";
import { islandPage as agents } from "../../../features/agent-status/plugin/page";
import { islandPage as calendar } from "../../../features/calendar/plugin/page";
import { islandPage as clipboard } from "../../../features/clipboard/plugin/page";
import { islandPage as shelf } from "../../../features/file-shelf/plugin/page";
import { islandPage as music } from "../../../features/media/plugin/page";
import { islandPage as qq } from "../../../features/messages/plugin/page";
import { islandPage as screenshots } from "../../../features/screenshot/plugin/page";
import { islandPage as timer } from "../../../features/timer/plugin/page";
import { islandPage as todo } from "../../../features/todos/plugin/page";
import { islandPage as translation } from "../../../features/translation/plugin/page";
import type { PlatformFeature } from "../../../lib/platform";
import type { IslandSettings } from "../../../lib/settings/types";
import type { SettingsIslandPagesText } from "../../../i18n/sections/settings/islandPages";

type BuiltinPageId = keyof SettingsIslandPagesText["page"];

export type BuiltinPageEntry = {
  id: BuiltinPageId;
  owner: string;
  icon: LucideIcon;
  shortcutOrder: number;
  headerDot: boolean;
  platform?: PlatformFeature;
  fallback?: (settings: IslandSettings) => boolean;
  needs?: (settings: IslandSettings) => boolean;
};

const entry = (page: { id: string; shortcutOrder: number; icon?: LucideIcon }, rest: Omit<BuiltinPageEntry, "id" | "shortcutOrder" | "icon"> & { icon?: LucideIcon }): BuiltinPageEntry => ({
  id: page.id as BuiltinPageId,
  shortcutOrder: page.shortcutOrder,
  icon: rest.icon ?? page.icon ?? Bot,
  ...rest,
});

export const BUILTIN_PAGES: readonly BuiltinPageEntry[] = [
  entry(agents, { owner: "agents", icon: Bot, headerDot: false, fallback: (settings) => settings.agentStatusEnabled }),
  entry(todo, { owner: "todos", headerDot: true, fallback: (settings) => settings.todoEnabled }),
  entry(music, { owner: "music", headerDot: true, platform: "music", fallback: (settings) => settings.musicEnabled }),
  entry(calendar, { owner: "calendar", headerDot: true, fallback: (settings) => settings.calendarEnabled }),
  entry(clipboard, { owner: "clipboard", headerDot: true, platform: "clipboard" }),
  entry(shelf, { owner: "file-shelf", headerDot: true, fallback: (settings) => settings.shelfEnabled }),
  entry(screenshots, { owner: "screenshot", headerDot: true, platform: "screenshot", fallback: (settings) => settings.screenshotEnabled }),
  entry(timer, { owner: "timer", headerDot: true }),
  entry(qq, { owner: "messages", icon: MessageCircle, headerDot: false }),
  entry(translation, {
    owner: "translation",
    icon: Languages,
    headerDot: false,
    platform: "translation",
    fallback: (settings) => settings.translationEnabled,
    needs: (settings) => settings.translationTarget === "island",
  }),
];
