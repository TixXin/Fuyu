import {
  Bell, BookOpen, Bot, Briefcase, CalendarDays, Camera, Cat, Clipboard, Clock, Cloud, Coffee, Flame, Folder, Gamepad2, Globe, Headphones,
  Heart, House, Image, LayoutGrid, Leaf, ListTodo, MessageCircle, Moon, Music, Rocket, Smile, Sparkles, Star, Sun, Timer, Zap,
} from "lucide-react";
import { createElement } from "react";
import { CustomPageIcon, type PageIconProps } from "../page-icons/CustomPageIcon";
import { lucideCatalogNow } from "../page-icons/lucideCatalog";
import { parsePageIcon } from "../../lib/settings/pageIconValue";
import { FuyuTextIcon } from "./FuyuTextIcon";
import { JellyfishIcon } from "./JellyfishIcon";
import type { PanelIconComponent } from "./panelIcons";

export const FUYU_TEXT_ICON = "text";
export const JELLYFISH_ICON = "jellyfish";

export const PAGE_ICON_CHOICES: Readonly<Record<string, PanelIconComponent>> = {
  star: Star,
  heart: Heart,
  sparkles: Sparkles,
  zap: Zap,
  flame: Flame,
  sun: Sun,
  moon: Moon,
  cloud: Cloud,
  leaf: Leaf,
  cat: Cat,
  smile: Smile,
  rocket: Rocket,
  coffee: Coffee,
  music: Music,
  headphones: Headphones,
  "book-open": BookOpen,
  briefcase: Briefcase,
  "calendar-days": CalendarDays,
  clock: Clock,
  timer: Timer,
  "list-todo": ListTodo,
  clipboard: Clipboard,
  folder: Folder,
  camera: Camera,
  image: Image,
  "gamepad-2": Gamepad2,
  house: House,
  bell: Bell,
  "message-circle": MessageCircle,
  bot: Bot,
  globe: Globe,
  "layout-grid": LayoutGrid,
};

const SPECIAL: Readonly<Record<string, PanelIconComponent>> = {
  [FUYU_TEXT_ICON]: FuyuTextIcon,
  [JELLYFISH_ICON]: JellyfishIcon,
};

const custom = new Map<string, Map<PanelIconComponent | undefined, PanelIconComponent>>();

function customComponent(name: string, fallback: PanelIconComponent | undefined): PanelIconComponent {
  const byFallback = custom.get(name) ?? new Map<PanelIconComponent | undefined, PanelIconComponent>();
  custom.set(name, byFallback);
  const known = byFallback.get(fallback);
  if (known) return known;
  const Component = (props: PageIconProps) => createElement(CustomPageIcon, { ...props, value: name, fallback });
  byFallback.set(fallback, Component);
  return Component;
}

export function pageIconComponent(name: string | undefined, fallback?: PanelIconComponent): PanelIconComponent | null {
  if (!name) return null;
  if (Object.prototype.hasOwnProperty.call(SPECIAL, name)) return SPECIAL[name];
  if (Object.prototype.hasOwnProperty.call(PAGE_ICON_CHOICES, name)) return PAGE_ICON_CHOICES[name];
  const parsed = parsePageIcon(name);
  if (!parsed) return null;
  if (parsed.kind === "name") {
    const catalog = lucideCatalogNow();
    if (catalog) return catalog.icon(parsed.name);
  }
  return customComponent(name, fallback);
}

export function fuyuPageIconName(icons: Readonly<Record<string, string>> | undefined, pageId: string, legacyJellyfish: boolean): string {
  return icons?.[pageId] ?? (legacyJellyfish ? JELLYFISH_ICON : FUYU_TEXT_ICON);
}
