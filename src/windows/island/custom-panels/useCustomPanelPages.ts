import { createElement, useEffect } from "react";
import { FuyuTextIcon } from "../../../components/island-widget/FuyuTextIcon";
import { useTranslation } from "../../../i18n";
import { FUYU_PAGE_ID, FUYU_PANEL_ID } from "../../../lib/settings/customPanels";
import { headerSlot, PANEL_LAYOUT_ID } from "../slots/header";
import { pageSlot } from "../slots/pageSlot";
import type { IslandPageProps } from "../IslandPages";
import { CustomPanelPage } from "./CustomPanelPage";
import { PanelLayoutButton } from "./PanelLayoutButton";
import { PanelPager } from "./paging/PanelPager";

const FUYU_ORDER = 0;
const FUYU_SHORTCUT_ORDER = 0;
const PANEL_PAGER_ID = "panel-pager";

function HeaderPager() {
  return createElement(PanelPager, { placement: "header" });
}

function FuyuPage({ settings }: IslandPageProps) {
  return createElement(CustomPanelPage, {
    panelId: FUYU_PANEL_ID,
    entrance: settings.widgetEntrance,
    dataMotion: settings.widgetDataMotion,
    motion: settings.islandMotion !== "none",
  });
}

export function useCustomPanelPages() {
  const name = useTranslation().island.homePage;
  useEffect(
    () =>
      pageSlot.add({
        id: FUYU_PAGE_ID,
        order: FUYU_ORDER,
        shortcutOrder: FUYU_SHORTCUT_ORDER,
        headerDot: true,
        title: name,
        icon: FuyuTextIcon,
        component: FuyuPage,
      }),
    [name],
  );
  useEffect(() => headerSlot.add({ id: PANEL_PAGER_ID, order: 998, enabled: (context) => context.page === FUYU_PAGE_ID, component: HeaderPager }), []);
  useEffect(() => headerSlot.add({ id: PANEL_LAYOUT_ID, order: 999, enabled: (context) => context.page === FUYU_PAGE_ID, component: PanelLayoutButton }), []);
}
