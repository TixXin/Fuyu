import { addAvailableItems, DEFAULT_FUYU_ITEMS, type CustomPanel, type PanelSize, type WidgetSizesOf } from "./customPanels.ts";

export const PANEL_TEMPLATES = ["fuyu", "workbench", "fun"] as const;
export type PanelTemplate = (typeof PANEL_TEMPLATES)[number];

type TemplateItem = { widget: string; size: PanelSize };

const TEMPLATE_ITEMS: Record<PanelTemplate, readonly TemplateItem[]> = {
  fuyu: DEFAULT_FUYU_ITEMS.map(([widget, size]) => ({ widget, size })),
  workbench: [
    { widget: "todos", size: "l" },
    { widget: "next-meeting", size: "m" },
    { widget: "session-count", size: "m" },
  ],
  fun: [
    { widget: "music", size: "m" },
    { widget: "@fuyu/weather", size: "m" },
    { widget: "lyrics", size: "w" },
  ],
};

export function applyPanelTemplate(panel: CustomPanel, template: PanelTemplate, sizesOf: WidgetSizesOf): CustomPanel {
  return addAvailableItems(panel, TEMPLATE_ITEMS[template].map(({ widget, size }) => [widget, size] as const), sizesOf);
}
