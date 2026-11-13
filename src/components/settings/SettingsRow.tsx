import type { ReactNode } from "react";
import "./SettingsRow.css";

export function SettingsRow({
  title,
  description,
  control,
  labelFor,
  indent = false,
  searchable = true,
  className,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  control?: ReactNode;
  labelFor?: string;
  indent?: boolean | 2 | 3;
  searchable?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={className ? `${rowClass(indent)} ${className}` : rowClass(indent)} data-search={searchable ? undefined : "off"}>
      <div className="settings-row__main">
        <div className="settings-row__text">
          {labelFor ? (
            <label className="settings-row__title" htmlFor={labelFor}>{title}</label>
          ) : (
            <span className="settings-row__title">{title}</span>
          )}
          {description ? <span className="settings-row__description">{description}</span> : null}
        </div>
        {control ? <div className="settings-row__control">{control}</div> : null}
      </div>
      {children}
    </div>
  );
}

function rowClass(indent: boolean | 2 | 3) {
  if (!indent) return "settings-row";
  return indent === true ? "settings-row settings-row--indent" : `settings-row settings-row--indent settings-row--indent-${indent}`;
}
