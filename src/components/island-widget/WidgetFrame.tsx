import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { WidgetFlashState } from "./useWidgetFlash";
import { WidgetFlash } from "./WidgetFlash";
import "./IslandWidget.css";

type WidgetFrameProps = {
  icon: LucideIcon;
  title: string;
  aside?: ReactNode;
  className?: string;
  flash?: WidgetFlashState;
  children: ReactNode;
};

export function WidgetFrame({ icon: Icon, title, aside, className, flash = null, children }: WidgetFrameProps) {
  return (
    <div className={className ? `island-widget ${className}` : "island-widget"}>
      <div className="island-widget__head">
        <Icon className="island-widget__icon" size={13} strokeWidth={2} aria-hidden="true" />
        <span className="island-widget__title">{title}</span>
        {aside ? <span className="island-widget__aside">{aside}</span> : null}
      </div>
      <div className="island-widget__body">{children}</div>
      <WidgetFlash flash={flash} />
    </div>
  );
}

export function WidgetEmpty({ children }: { children: ReactNode }) {
  return <p className="island-widget__empty">{children}</p>;
}
