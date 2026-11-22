import type { ReactNode } from "react";
import type { IslandSettings } from "../../../lib/settings/types";
import { useCollapsedPluginItems } from "../sections/useCollapsedPluginItems";
import { ExpandedLayout } from "./ExpandedLayout";
import { LayoutStage } from "./LayoutStage";

export function IslandPanelPage({ settings }: { settings: IslandSettings }) {
  const { pages, widgets } = useCollapsedPluginItems();
  const stage = (preview: ReactNode) => <LayoutStage mode="expanded">{preview}</LayoutStage>;
  return (
    <div className="island-layout" data-mode="expanded">
      <ExpandedLayout settings={settings} pluginPages={pages} pluginWidgets={widgets} stage={stage} />
    </div>
  );
}
