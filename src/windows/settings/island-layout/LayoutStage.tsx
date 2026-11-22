import type { ReactNode } from "react";
import { useTranslation } from "../../../i18n";
import "./LayoutStage.css";

export type LayoutMode = "bar" | "expanded";

export function LayoutStage({ mode, children }: { mode: LayoutMode; children: ReactNode }) {
  const text = useTranslation().settings.islandPages.modes;
  return (
    <section className="layout-stage" data-mode={mode} aria-label={text[mode]}>
      <div className="layout-stage__view">{children}</div>
    </section>
  );
}
