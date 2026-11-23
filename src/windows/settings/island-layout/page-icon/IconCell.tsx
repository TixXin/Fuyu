import type { PanelIconComponent } from "../../../../components/island-widget/panelIcons";

export type CellHandlers = {
  current: string;
  tabbable: string | null;
  onPick: (value: string) => void;
  onPeek: (value: string | null) => void;
};

type IconCellProps = CellHandlers & {
  value: string;
  label: string;
  icon: PanelIconComponent;
  wide?: boolean;
  caption?: string;
};

export function IconCell({ value, label, icon: Icon, wide, caption, current, tabbable, onPick, onPeek }: IconCellProps) {
  return (
    <button
      className="page-icon-cell"
      type="button"
      role="radio"
      data-icon-cell=""
      data-icon={value || "default"}
      data-wide={wide || caption ? "" : undefined}
      aria-checked={current === value}
      aria-label={label}
      title={label}
      tabIndex={tabbable === value ? 0 : -1}
      onClick={() => onPick(value)}
      onMouseEnter={() => onPeek(value)}
      onMouseLeave={() => onPeek(null)}
      onFocus={(event) => {
        if (event.currentTarget.matches(":focus-visible")) onPeek(value);
      }}
      onBlur={() => onPeek(null)}
    >
      <Icon size={16} strokeWidth={1.8} />
      {caption ? <span>{caption}</span> : null}
    </button>
  );
}
