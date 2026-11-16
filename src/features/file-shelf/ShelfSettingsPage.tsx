import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsNumberRow } from "../../components/settings/SettingsNumberRow";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { MAX_SHELF_ITEMS, MIN_SHELF_ITEMS, SHELF_CLEANUP_DAYS } from "../../lib/settings/settings";
import type { IslandSettings, ShelfDoubleClick } from "../../lib/settings/types";
import { useTranslation } from "../../i18n";
import { FeatureHeader } from "../../windows/settings/FeatureHeader";
import { SlotView } from "../plugin-kernel/SlotView";
import { settingsSections } from "../../windows/settings/slots/sectionSlot";

type ShelfSectionProps = {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
};

function BehaviorSection({ settings, onSettingsChange }: ShelfSectionProps) {
  const t = useTranslation();
  const labels = t.settings.fileShelf;
  const update = (patch: Partial<IslandSettings>) => onSettingsChange({ ...settings, ...patch });
  const doubleClickOptions = [
    { value: "open", label: labels.doubleClickOpen },
    { value: "reveal", label: labels.doubleClickReveal },
  ] as const;

  return (
    <SettingsGroup title={labels.title}>
      <SettingsToggleRow
        title={labels.expandOnDrop}
        description={settings.shelfExpandOnDrop ? undefined : labels.expandOnDropHint}
        checked={settings.shelfExpandOnDrop}
        onChange={(shelfExpandOnDrop) => update({ shelfExpandOnDrop })}
      />
      <SettingsRow
        title={labels.doubleClick}
        control={
          <SettingsSelect<ShelfDoubleClick>
            value={settings.shelfDoubleClick}
            options={doubleClickOptions}
            ariaLabel={labels.doubleClick}
            onChange={(shelfDoubleClick) => update({ shelfDoubleClick })}
          />
        }
      />
      <SettingsToggleRow title={labels.showCount} checked={settings.shelfShowCount} onChange={(shelfShowCount) => update({ shelfShowCount })} />
    </SettingsGroup>
  );
}

function CleanupSection({ settings, onSettingsChange }: ShelfSectionProps) {
  const t = useTranslation();
  const labels = t.settings.fileShelf;
  const update = (patch: Partial<IslandSettings>) => onSettingsChange({ ...settings, ...patch });
  const cleanupOptions = SHELF_CLEANUP_DAYS.map((days) => ({
    value: String(days),
    label: days === 0 ? labels.cleanupNever : labels.cleanupDays(days),
  }));

  return (
    <SettingsGroup title={labels.cleanupTitle} footer={labels.cleanupHint}>
      <SettingsRow
        title={labels.autoCleanup}
        control={
          <SettingsSelect
            value={String(settings.shelfAutoCleanupDays)}
            options={cleanupOptions}
            ariaLabel={labels.autoCleanup}
            onChange={(days) => update({ shelfAutoCleanupDays: Number(days) })}
          />
        }
      />
      <SettingsToggleRow title={labels.removeMissing} checked={settings.shelfRemoveMissing} onChange={(shelfRemoveMissing) => update({ shelfRemoveMissing })} />
      <SettingsToggleRow
        title={labels.removeAfterDragOut}
        checked={settings.shelfRemoveAfterDragOut}
        onChange={(shelfRemoveAfterDragOut) => update({ shelfRemoveAfterDragOut })}
      />
      <SettingsNumberRow
        title={labels.maxItems}
        value={settings.shelfMaxItems}
        min={MIN_SHELF_ITEMS}
        max={MAX_SHELF_ITEMS}
        onChange={(shelfMaxItems) => update({ shelfMaxItems })}
      />
    </SettingsGroup>
  );
}

const sections = settingsSections<ShelfSectionProps, "shelf">();

sections.add({ id: "shelf.behavior", category: "shelf", order: 10, component: BehaviorSection });
sections.add({ id: "shelf.cleanup", category: "shelf", order: 20, component: CleanupSection });

export function ShelfSettingsPage(props: ShelfSectionProps) {
  return (
    <>
      <FeatureHeader feature="shelf" />
      <SlotView slot={sections} group="shelf" props={props} />
    </>
  );
}
