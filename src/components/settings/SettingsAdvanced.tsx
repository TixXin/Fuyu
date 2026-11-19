import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "../../i18n";
import "./SettingsAdvanced.css";

export function SettingsAdvanced({ children, indent = false, label, openLabel }: {
  children: ReactNode;
  indent?: boolean;
  label?: string;
  openLabel?: string;
}) {
  const advanced = useTranslation().common.advanced;
  const [open, setOpen] = useState(false);
  return (
    <details className={indent ? "settings-advanced settings-advanced--indent" : "settings-advanced"} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="settings-advanced__toggle">
        <ChevronRight className="settings-advanced__chevron" size={14} aria-hidden="true" />
        {(open && openLabel) || label || advanced}
      </summary>
      <div className="settings-advanced__body">{children}</div>
    </details>
  );
}
