import { useState, type ReactNode } from "react";
import type { BarUsagePage, BarUsageWidget } from "../../../features/plugin-kernel/barUsage";
import { skipMissingBattery, useHasBattery } from "../../../features/system-widgets/batteryPresence";
import { FUYU_PAGE_ID, fuyuPanel, fuyuPanels, type CustomPanel } from "../../../lib/settings/customPanels";
import type { IslandSettings } from "../../../lib/settings/types";
import { useCustomPanels } from "../../../lib/settings/useCustomPanels";
import { stripRoom } from "../../island/custom-panels/panelSize";
import { stripGeometry } from "../../island/custom-panels/stripGeometry";
import { islandPageSize } from "../../island/pageSize";
import { ExpandedPreview } from "./ExpandedPreview";
import { PageIconPicker } from "./PageIconPicker";
import { PageStrip } from "./PageStrip";
import { PanelEditor } from "./PanelEditor";
import { SizePicker } from "./SizePicker";
import { useIslandPageRows } from "./useIslandPageRows";
import { useWidgetLibrary } from "./useWidgetLibrary";
import "./ExpandedLayout.css";

type ExpandedLayoutProps = {
  settings: IslandSettings;
  pluginPages: readonly BarUsagePage[] | null;
  pluginWidgets: readonly BarUsageWidget[];
  stage: (preview: ReactNode) => ReactNode;
};

export function ExpandedLayout({ settings, pluginPages, pluginWidgets, stage }: ExpandedLayoutProps) {
  const { panels, save: savePanels } = useCustomPanels();
  const { rows, layout, save, pluginsListed, screenshotOn } = useIslandPageRows(settings, pluginPages);
  const library = useWidgetLibrary(pluginWidgets);
  const [pageId, setPageId] = useState<string | null>(null);
  const [widgetId, setWidgetId] = useState<string | null>(null);
  const current = rows.find((row) => row.id === pageId) ?? rows.find((row) => !row.hidden && !row.off) ?? rows[0];
  const sizesOf = skipMissingBattery((id: string) => {
    const widget = library.find(id);
    return widget?.available ? widget.sizes : null;
  }, useHasBattery());
  const panel = current?.panel ? fuyuPanel(panels, library.widgets.length > 0 ? sizesOf : undefined) : undefined;
  const selected = (panel?.items.find((item) => item.widget === widgetId) ?? panel?.items[0])?.widget;

  const change = (next: CustomPanel) => savePanels(fuyuPanels(next));
  const room = stripRoom(islandPageSize(settings, FUYU_PAGE_ID));
  const strip = (next: CustomPanel) => stripGeometry(next, room, false).panel;

  return (
    <>
      {stage(<ExpandedPreview settings={settings} rows={rows} current={current} screenshotOn={screenshotOn} panel={panel} library={library} selected={selected} onPage={setPageId} onWidget={setWidgetId} onPanel={change} />)}
      <PageStrip rows={rows} layout={layout} save={save} current={current?.id} onPick={setPageId} pluginsListed={pluginsListed} />
      {current ? <PageIconPicker key={current.id} row={current} layout={layout} save={save} legacyJellyfish={settings.fuyuTabIcon} /> : null}
      {panel ? (
        <div className="panel-editing" key={panel.id}>
          <PanelEditor panel={panel} library={library} selected={selected} onSelect={setWidgetId} onChange={change} strip={strip} />
          <SizePicker panel={panel} library={library} selected={selected} onSelect={setWidgetId} onChange={change} />
        </div>
      ) : null}
    </>
  );
}
