import { Check, LayoutDashboard } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { FUYU_PANEL_ID } from "../../../lib/settings/customPanels";
import { startPanelEditing, stopPanelEditing, usePanelEditing } from "./panelEditing";

export function PanelLayoutButton() {
  const t = useTranslation().islandWidgets.panel;
  const editing = usePanelEditing() === FUYU_PANEL_ID;
  const label = editing ? t.done : t.edit;
  return (
    <button
      className="icon-button custom-panel__edit"
      type="button"
      aria-pressed={editing}
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        if (editing) stopPanelEditing();
        else startPanelEditing(FUYU_PANEL_ID);
      }}
    >
      {editing ? <Check size={16} strokeWidth={2.4} aria-hidden="true" /> : <LayoutDashboard size={16} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />}
    </button>
  );
}
