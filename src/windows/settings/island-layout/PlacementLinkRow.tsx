import { SettingsLinkButton } from "../../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import type { IslandPlacementLinkProps } from "../../../features/plugin-kernel/settingsSlots";
import { useTranslation } from "../../../i18n";
import { usePlaceText } from "./usePlaceText";
import { openIslandLayoutItem } from "./islandLayoutFocus";

export function PlacementLink({ item }: { item: string }) {
  const text = useTranslation().settings.collapsedItems;
  const place = usePlaceText(item);
  return <SettingsLinkButton onClick={() => openIslandLayoutItem(item)}>{`${place} · ${text.adjust} ›`}</SettingsLinkButton>;
}

export function PlacementLinkRow({ item, title }: IslandPlacementLinkProps) {
  const text = useTranslation().settings.collapsedItems;
  return <SettingsRow searchable={false} className="island-placement-link" title={title ?? text.onIsland} control={<PlacementLink item={item} />} />;
}
