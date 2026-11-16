import type { ReactNode } from "react";

export function TraySwitch({
  label,
  icon,
  checked,
  className,
  onToggle,
}: {
  label: string;
  icon?: ReactNode;
  checked: boolean;
  className?: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={className ? `tray-card__switch ${className}` : "tray-card__switch"}
      onClick={onToggle}
    >
      {icon}
      <span className="tray-card__switch-label">{label}</span>
      <span className="tray-card__track" aria-hidden="true">
        <span className="tray-card__knob" />
      </span>
    </button>
  );
}
