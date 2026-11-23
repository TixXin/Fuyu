import { ArrowUpRight } from "lucide-react";
import { clickOnly } from "./clickOnly";
import "./WidgetOpenButton.css";

export function WidgetOpenButton({ label, onOpen }: { label: string; onOpen: () => void }) {
  return (
    <button className="island-widget-open" type="button" aria-label={label} title={label} onClick={clickOnly(onOpen)}>
      <ArrowUpRight size={12} strokeWidth={2.2} aria-hidden="true" />
    </button>
  );
}
