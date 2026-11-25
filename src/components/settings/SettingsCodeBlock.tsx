import type { ReactNode } from "react";
import { Terminal } from "lucide-react";
import "./SettingsCodeBlock.css";

export function SettingsCodeBlock({
  label,
  code,
  action,
  codeClassName,
}: {
  label: string;
  code: string;
  action?: ReactNode;
  codeClassName?: string;
}) {
  return (
    <div className="settings-code-block" data-search="off">
      <div className="settings-code-block__bar">
        <span className="settings-code-block__label">
          <Terminal size={12} strokeWidth={2.2} aria-hidden="true" />
          {label}
        </span>
        {action ? <span className="settings-code-block__action">{action}</span> : null}
      </div>
      <pre className={codeClassName ? `settings-code-block__pre ${codeClassName}` : "settings-code-block__pre"}>
        {code}
      </pre>
    </div>
  );
}
