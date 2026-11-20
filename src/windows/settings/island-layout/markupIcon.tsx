import DOMPurify from "dompurify";
import type { WidgetIcon } from "../../../features/plugin-kernel/widgetLibrary";

const icons = new Map<string, WidgetIcon>();

export function markupIcon(markup: string): WidgetIcon {
  const known = icons.get(markup);
  if (known) return known;
  const clean = DOMPurify.sanitize(markup, { USE_PROFILES: { svg: true, svgFilters: true } });
  const Icon: WidgetIcon = ({ size = 16, className }) => (
    <span className={className ? `widget-markup-icon ${className}` : "widget-markup-icon"} style={{ width: size, height: size }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: clean }} />
  );
  icons.set(markup, Icon);
  return Icon;
}
