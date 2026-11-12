import type { CSSProperties, DragEvent, ReactNode } from "react";
import { Bot, Camera, ClipboardList, FolderInput, Languages, ListTodo, Mail, Music, type LucideIcon } from "lucide-react";
import { hexToRgba } from "../../features/appearance/settings";
import type { IslandSettings } from "../../features/appearance/types";
import { MODULES, type OnboardingModule } from "./personas";
import "./MiniIsland.css";

export const MODULE_ICONS: Record<OnboardingModule, LucideIcon> = {
  todo: ListTodo,
  music: Music,
  agents: Bot,
  translation: Languages,
  shelf: FolderInput,
  mail: Mail,
  screenshot: Camera,
  clipboard: ClipboardList,
};

/**
 * The island drawn on the guide's small desktop, in the colours, opacity and corners of the
 * settings being chosen: a bar with a light, a line of text and an icon per module, which opens
 * into a panel. A drawing that answers to the pointer and to drops, not the island itself.
 */
export function MiniIsland({
  settings,
  modules,
  label,
  live = false,
  expanded = false,
  panel,
  highlight = false,
  ariaLabel,
  onPointerEnter,
  onPointerLeave,
  onClick,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  /** Settings with the colours of the tone in use (useResolvedTheme). */
  settings: IslandSettings;
  modules: ReadonlySet<OnboardingModule>;
  label: string;
  /** The light breathes, as while an agent works. */
  live?: boolean;
  expanded?: boolean;
  panel?: ReactNode;
  /** A soft ring that asks to be touched. */
  highlight?: boolean;
  ariaLabel?: string;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  onClick?: () => void;
  onDragOver?: (event: DragEvent<HTMLElement>) => void;
  onDragLeave?: () => void;
  onDrop?: (event: DragEvent<HTMLElement>) => void;
}) {
  const style = {
    "--mini-fill": hexToRgba(settings.islandBackgroundColor, Math.max(settings.opacity, 70) / 100),
    "--mini-text": settings.taskTextColor,
    "--mini-pulse": settings.pulseColor,
    "--mini-radius": `${settings.islandCornerRadius * 0.6}px`,
    "--mini-panel-radius": `${settings.islandCornerRadius * 0.75}px`,
  } as CSSProperties;
  const className = ["mini-island", expanded && "mini-island--expanded", highlight && "mini-island--highlight", onClick && "mini-island--button"]
    .filter(Boolean)
    .join(" ");
  const shown = MODULES.filter((module) => modules.has(module));

  return (
    <div
      className={className}
      style={style}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel}
      aria-expanded={onClick ? expanded : undefined}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onClick={onClick}
      onKeyDown={(event) => {
        if (onClick && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onClick();
        }
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="mini-island__bar">
        <span className={live ? "mini-island__light mini-island__light--live" : "mini-island__light"} aria-hidden="true" />
        <span className="mini-island__label" key={label}>{label}</span>
        <span className="mini-island__icons" aria-hidden="true">
          {shown.map((module) => {
            const Icon = MODULE_ICONS[module];
            return <Icon key={module} className="mini-island__icon" size={13} strokeWidth={2.2} />;
          })}
        </span>
      </div>
      {expanded && panel && <div className="mini-island__panel">{panel}</div>}
    </div>
  );
}
