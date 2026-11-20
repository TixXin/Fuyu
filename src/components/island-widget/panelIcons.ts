import type { ComponentType } from "react";
import { BookOpen, Briefcase, Coffee, Gamepad2, Heart, House, LayoutGrid, Music, Star, Zap } from "lucide-react";
import type { PanelIcon } from "../../lib/settings/customPanels";

export type PanelIconComponent = ComponentType<{ size?: number | string; strokeWidth?: number | string; absoluteStrokeWidth?: boolean; className?: string }>;

export const PANEL_ICON_COMPONENTS: Readonly<Record<PanelIcon, PanelIconComponent>> = {
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
