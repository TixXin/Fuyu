import {
  Bell, BookOpen, Bot, Briefcase, CalendarDays, Camera, Cat, Clipboard, Clock, Cloud, Coffee, Flame, Folder, Gamepad2, Globe, Headphones,
  Heart, House, Image, LayoutGrid, Leaf, ListTodo, MessageCircle, Moon, Music, Rocket, Smile, Sparkles, Star, Sun, Timer, Zap,
} from "lucide-react";
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

export function pageIconComponent(name: string | undefined): PanelIconComponent | null {
  if (!name) return null;
  return SPECIAL[name] ?? (Object.prototype.hasOwnProperty.call(PAGE_ICON_CHOICES, name) ? PAGE_ICON_CHOICES[name] : null);
}

export function fuyuPageIconName(icons: Readonly<Record<string, string>> | undefined, pageId: string, legacyJellyfish: boolean): string {
  return icons?.[pageId] ?? (legacyJellyfish ? JELLYFISH_ICON : FUYU_TEXT_ICON);
}
