import { isValidElement, useContext, type ReactNode } from "react";
import { useTranslation } from "../../i18n";
import { SettingsGroupTitleContext } from "./SettingsGroup";
import { useSettingsWhatsNew } from "./whatsNewContext";
import "./SettingsRow.css";

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

export function SettingsRow({
  title,
  description,
  control,
  labelFor,
  indent = false,
  searchable = true,
  since,
  className,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  control?: ReactNode;
  labelFor?: string;
  indent?: boolean | 2 | 3;
  searchable?: boolean;
  since?: string;
  className?: string;
  children?: ReactNode;
}) {
  const { isNew } = useSettingsWhatsNew();
  const group = useContext(SettingsGroupTitleContext);
  const badge = useTranslation().settings.categories.whatsNew.badge;
  const titleText = textOf(title).replace(/\s+/g, " ").trim();
  const showNew = isNew(since, { group, title: titleText });
  const titleNode = labelFor ? (
    <label className="settings-row__title" htmlFor={labelFor}>{title}</label>
  ) : (
    <span className="settings-row__title">{title}</span>
  );
  return (
    <div
      className={className ? `${rowClass(indent)} ${className}` : rowClass(indent)}
      data-search={searchable ? undefined : "off"}
      data-since={since || undefined}
    >
      <div className="settings-row__main">
        <div className="settings-row__text">
          {showNew ? (
            <span className="settings-row__heading">
              {titleNode}
              <span className="settings-row__new">{badge}</span>
            </span>
          ) : titleNode}
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
