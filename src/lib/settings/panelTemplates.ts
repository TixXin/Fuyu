import { addPanelItem, defaultWidgetSize, type CustomPanel, type PanelSize } from "./customPanels.ts";

export const PANEL_TEMPLATES = ["workbench", "fun"] as const;
export type PanelTemplate = (typeof PANEL_TEMPLATES)[number];

type TemplateItem = { widget: string; size: PanelSize };

const TEMPLATE_ITEMS: Record<PanelTemplate, readonly TemplateItem[]> = {
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

export function applyPanelTemplate(panel: CustomPanel, template: PanelTemplate, sizesOf: (widget: string) => readonly PanelSize[] | null): CustomPanel {
  return TEMPLATE_ITEMS[template].reduce((next, { widget, size }) => {
    const sizes = sizesOf(widget);
    if (!sizes) return next;
    const chosen = sizes.includes(size) ? size : defaultWidgetSize(sizes);
    return chosen ? addPanelItem(next, widget, chosen) : next;
  }, panel);
}
