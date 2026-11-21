import { isPanelEditing } from "./custom-panels/panelEditing";

export function isIslandHeld() {
  return isPanelEditing();
}
