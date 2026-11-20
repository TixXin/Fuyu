import { useState, type ReactNode } from "react";
import type { BarUsagePage, BarUsageWidget } from "../../../features/plugin-kernel/barUsage";
import { fuyuPanel, fuyuPanels, type CustomPanel } from "../../../lib/settings/customPanels";
import type { IslandSettings } from "../../../lib/settings/types";
import { useCustomPanels } from "../../../lib/settings/useCustomPanels";
import { ExpandedPreview } from "./ExpandedPreview";
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
  const { rows, layout, save, pluginsListed } = useIslandPageRows(settings, pluginPages);
  const library = useWidgetLibrary(pluginWidgets);
  const [pageId, setPageId] = useState<string | null>(null);
  const [widgetId, setWidgetId] = useState<string | null>(null);
  const current = rows.find((row) => row.id === pageId) ?? rows.find((row) => !row.hidden && !row.off) ?? rows[0];
  const panel = current?.panel ? fuyuPanel(panels) : undefined;
  const selected = (panel?.items.find((item) => item.widget === widgetId) ?? panel?.items[0])?.widget;

  const change = (next: CustomPanel) => savePanels(fuyuPanels(next));

  return (
    <>
      {stage(<ExpandedPreview rows={rows} current={current} panel={panel} library={library} selected={selected} onPage={setPageId} onWidget={setWidgetId} onPanel={change} />)}
      <PageStrip rows={rows} layout={layout} save={save} current={current?.id} onPick={setPageId} pluginsListed={pluginsListed} />
      {panel ? (
        <div className="panel-editing" key={panel.id}>
          <PanelEditor panel={panel} library={library} selected={selected} onSelect={setWidgetId} onChange={change} />
          <SizePicker panel={panel} library={library} selected={selected} onSelect={setWidgetId} onChange={change} />
        </div>
      ) : null}
    </>
  );
}
