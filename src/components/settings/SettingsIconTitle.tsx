import type { CSSProperties, ReactNode } from "react";
import "./SettingsIconTitle.css";

export function SettingsIconTitle({ icon, tone, children }: { icon: ReactNode; tone?: string; children: string }) {
  return (
    <span className="settings-icon-title" style={tone ? ({ "--settings-icon-tone": tone } as CSSProperties) : undefined}>
      <span className="settings-icon-title__icon" aria-hidden="true">{icon}</span>
      {children}
    </span>
  );
}
