import { Check, X } from "lucide-react";
import { useTranslation } from "../../i18n";
import type { WidgetFlashState } from "./useWidgetFlash";
import "./WidgetFlash.css";

export function WidgetFlash({ flash }: { flash: WidgetFlashState }) {
  const text = useTranslation().islandWidgets.content;
  if (!flash) return null;
  const Icon = flash.kind === "done" ? Check : X;
  const label = flash.label ?? (flash.kind === "done" ? text.done : text.actionFailed);
  return (
    <div key={flash.key} className="island-widget__flash" data-kind={flash.kind} role="status" title={label}>
      <span className="island-widget__flash-pill">
        <Icon size={13} strokeWidth={2.6} aria-hidden="true" />
        <span>{label}</span>
      </span>
    </div>
  );
}
