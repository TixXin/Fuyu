import { createElement, useEffect, useMemo, type FunctionComponent } from "react";
import { PANEL_ICON_COMPONENTS } from "../../../components/island-widget/panelIcons";
import { useTranslation } from "../../../i18n";
import { panelPageId, type PanelIcon } from "../../../lib/settings/customPanels";
import { useCustomPanels } from "../../../lib/settings/useCustomPanels";
import { pageSlot } from "../slots/pageSlot";
import { CustomPanelPage } from "./CustomPanelPage";

const PANEL_ORDER = 900;
const PANEL_SHORTCUT_ORDER = 100;
const pages = new Map<string, FunctionComponent>();

function panelComponent(id: string): FunctionComponent {
  let component = pages.get(id);
  if (!component) {
    component = function PanelPage() {
      return createElement(CustomPanelPage, { panelId: id });
    };
    pages.set(id, component);
  }
  return component;
}

export function useCustomPanelPages() {
  const { panels } = useCustomPanels();
  const fallbackName = useTranslation().islandWidgets.panel.defaultName;
  const signature = panels.map((panel) => [panel.id, panel.name, panel.icon].join("\u0000")).join("\u0001");
  const heads = useMemo(
    () =>
      signature === ""
        ? []
        : signature.split("\u0001").map((part) => {
            const [id = "", name = "", icon = ""] = part.split("\u0000");
            return { id, name, icon: icon as PanelIcon };
          }),
    [signature],
  );
  useEffect(() => {
    const removals = heads.map((panel, index) =>
      pageSlot.add({
        id: panelPageId(panel.id),
        order: PANEL_ORDER + index,
        shortcutOrder: PANEL_SHORTCUT_ORDER + index,
        headerDot: true,
        title: panel.name || fallbackName,
        icon: PANEL_ICON_COMPONENTS[panel.icon],
        component: panelComponent(panel.id),
      }),
    );
    return () => removals.forEach((remove) => remove());
  }, [fallbackName, heads]);
}
