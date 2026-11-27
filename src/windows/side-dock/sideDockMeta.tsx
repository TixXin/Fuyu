import type { ComponentType, ReactNode } from "react";
import { Bot, Languages, LayoutGrid, MessageCircle } from "lucide-react";
import { FuyuTextIcon } from "../../components/island-widget/FuyuTextIcon";
import { FUYU_TEXT_ICON, fuyuPageIconName, JELLYFISH_ICON, pageIconComponent } from "../../components/island-widget/pageIcons";
import { JellyfishMark } from "../../components/jellyfish/JellyfishMark";
import { PluginIcon } from "../../features/plugin-kernel/PluginIcon";
import type { IslandPageMeta, SlotEntry } from "../../features/plugin-kernel/slots";
import type { IslandText } from "../../i18n/sections/island";
import { FUYU_PAGE_ID } from "../../lib/settings/customPanels";
import { customPageName, type IslandPagesLayout } from "../../lib/settings/islandPages";
import type { IslandFeatures } from "../island/features";
import type { IslandPageProps } from "../island/IslandPages";
import type { BuiltinPage } from "../island/types";
import type { PageLabelItem } from "../island/usePageLabel";

export type SideDockPageEntry = SlotEntry<IslandPageProps, IslandPageMeta<IslandFeatures, BuiltinPage>>;

const FALLBACK_BUILTIN_ICONS: Readonly<Record<string, ComponentType<{ size?: number; strokeWidth?: number }>>> = {
  agents: Bot,
  qq: MessageCircle,
  translation: Languages,
  [FUYU_PAGE_ID]: LayoutGrid,
};

export function sideDockPageLabel(
  entry: SideDockPageEntry,
  baseLabel: (item: PageLabelItem) => string,
  islandText: IslandText,
  pageLayout?: IslandPagesLayout,
): string {
  const custom = customPageName(pageLayout, entry.id);
  if (custom) return custom;
  if (!entry.external) {
    if (entry.id === FUYU_PAGE_ID) return islandText.homePage;
    if (entry.id === "agents") return islandText.sideDock.pageNames.agents;
    if (entry.id === "qq") return islandText.sideDock.pageNames.qq;
    if (entry.id === "translation") return islandText.sideDock.pageNames.translation;
  }
  return baseLabel(entry);
}

export function renderSideDockIcon(
  entry: SideDockPageEntry,
  label: string,
  pageLayout: IslandPagesLayout,
  fuyuTabIcon: boolean,
  size = 15,
): ReactNode {
  const chosen = entry.id === FUYU_PAGE_ID
    ? fuyuPageIconName(pageLayout.icons, entry.id, fuyuTabIcon)
    : pageLayout.icons?.[entry.id];
  if (chosen === JELLYFISH_ICON) {
    return <JellyfishMark mood="idle" paused height={size} />;
  }
  if (chosen === FUYU_TEXT_ICON) {
    return <LayoutGrid size={size} strokeWidth={1.7} aria-hidden="true" />;
  }
  const customIcon = pageIconComponent(chosen, entry.external ? undefined : entry.icon ?? undefined);
  if (customIcon) {
    const Custom = customIcon === FuyuTextIcon ? LayoutGrid : customIcon;
    return <Custom size={size} strokeWidth={1.7} aria-hidden="true" />;
  }
  if (entry.external) {
    return <PluginIcon icon={entry.icon} owner={entry.owner} label={label} size={size} strokeWidth={1.7} />;
  }
  if (entry.icon) {
    const Builtin = entry.icon === FuyuTextIcon ? LayoutGrid : entry.icon;
    return <Builtin size={size} strokeWidth={1.7} aria-hidden="true" />;
  }
  const Fallback = FALLBACK_BUILTIN_ICONS[entry.id];
  if (Fallback) {
    return <Fallback size={size} strokeWidth={1.7} aria-hidden="true" />;
  }
  return null;
}
