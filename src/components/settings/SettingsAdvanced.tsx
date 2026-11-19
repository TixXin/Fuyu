import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "../../i18n";
import "./SettingsAdvanced.css";

export function SettingsAdvanced({ children, indent = false }: { children: ReactNode; indent?: boolean }) {
  const label = useTranslation().common.advanced;
  return (
    <details className={indent ? "settings-advanced settings-advanced--indent" : "settings-advanced"}>
      <summary className="settings-advanced__toggle">
        <ChevronRight className="settings-advanced__chevron" size={14} aria-hidden="true" />
        {label}
      </summary>
      <div className="settings-advanced__body">{children}</div>
    </details>
  );
}
