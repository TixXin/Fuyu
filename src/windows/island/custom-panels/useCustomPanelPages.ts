import { createElement, useEffect } from "react";
import { FuyuTextIcon } from "../../../components/island-widget/FuyuTextIcon";
import { useTranslation } from "../../../i18n";
import { FUYU_PAGE_ID, FUYU_PANEL_ID } from "../../../lib/settings/customPanels";
import { pageSlot } from "../slots/pageSlot";
import { CustomPanelPage } from "./CustomPanelPage";

const FUYU_ORDER = 0;
const FUYU_SHORTCUT_ORDER = 0;

function FuyuPage() {
  return createElement(CustomPanelPage, { panelId: FUYU_PANEL_ID });
}

export function useCustomPanelPages() {
  const name = useTranslation().island.appName;
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
}
