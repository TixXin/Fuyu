import type { LucideIcon } from "lucide-react";
import type { Translations } from "../../i18n";
import type { IslandWidgetSize } from "./slots.ts";

export type WidgetGroup = keyof Translations["islandWidgets"]["groups"];

export type BuiltinWidget = {
  id: string;
  owner: string;
  icon: LucideIcon;
  group: WidgetGroup;
  sizes: readonly IslandWidgetSize[];
  order: number;
  label: (t: Translations) => string;
};
