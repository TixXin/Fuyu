import type { ReactNode } from "react";
import { useTranslation } from "../../../i18n";
import "./LayoutStage.css";

export type LayoutMode = "bar" | "expanded";

const MODES: readonly LayoutMode[] = ["bar", "expanded"];

export function LayoutStage({ mode, onMode, children }: { mode: LayoutMode; onMode: (mode: LayoutMode) => void; children: ReactNode }) {
  const text = useTranslation().settings.islandPages.modes;
  return (
    <section className="layout-stage" data-mode={mode} aria-label={text.label}>
      <div className="layout-stage__view">{children}</div>
      <div className="layout-stage__switch" role="tablist" aria-label={text.label}>
        {MODES.map((value) => (
          <button key={value} type="button" role="tab" data-mode={value} aria-selected={mode === value} onClick={() => onMode(value)}>
            {text[value]}
          </button>
        ))}
      </div>
    </section>
  );
}
