import { BookOpen, Briefcase, Coffee, Gamepad2, Heart, House, LayoutGrid, Music, Star, Zap, type LucideIcon } from "lucide-react";
import type { PanelIcon } from "../../lib/settings/customPanels";

export const PANEL_ICON_COMPONENTS: Readonly<Record<PanelIcon, LucideIcon>> = {
  "layout-grid": LayoutGrid,
  star: Star,
  briefcase: Briefcase,
  coffee: Coffee,
  music: Music,
  zap: Zap,
  heart: Heart,
  home: House,
  gamepad: Gamepad2,
  book: BookOpen,
};
