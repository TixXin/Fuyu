import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";
import type { IslandSettings } from "../../lib/settings/types";
import { useSideDocks } from "../../lib/settings/useSideDocks";
import { useCollapsedPluginItems } from "./sections/useCollapsedPluginItems";
import { SideDockSettingsSection } from "./island-layout/SideDockSettingsSection";
import { useIslandPageRows } from "./island-layout/useIslandPageRows";

export function SideDocksSettingsPage({ settings }: { settings: IslandSettings }) {
  const text = useTranslation().settings.islandPages.sideDocks;
  const { pages } = useCollapsedPluginItems();
  const { rows, layout, save } = useIslandPageRows(settings, pages);
  const { settings: sideDocks, save: saveSideDocks } = useSideDocks();

  return (
    <div className="settings-stack">
      <SettingsGroup title={text.title}>
        <SettingsToggleRow
          title={text.zones.right}
          description={text.hint}
          since="next"
          checked={sideDocks.right.enabled}
          onChange={(enabled) => saveSideDocks({ ...sideDocks, right: { ...sideDocks.right, enabled } })}
        />
        <SettingsToggleRow
          title={text.zones.left}
          since="next"
          checked={sideDocks.left.enabled}
          onChange={(enabled) => saveSideDocks({ ...sideDocks, left: { ...sideDocks.left, enabled } })}
        />
      </SettingsGroup>
      <SideDockSettingsSection rows={rows} layout={layout} save={save} />
    </div>
  );
}
