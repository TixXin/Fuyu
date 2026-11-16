import type { Ref } from "react";
import { useTranslation } from "../../i18n";
import { handleCardKeys } from "./cardKeys";
import { CompactLayout } from "./CompactLayout";
import { EntryLayout } from "./EntryLayout";
import { StatusLayout } from "./StatusLayout";
import type { TrayMenuLayout } from "./storage";
import type { TrayCardProps } from "./types";
import "./TrayMenuCard.css";
import "./TrayCardParts.css";

const LAYOUTS = { entry: EntryLayout, status: StatusLayout, compact: CompactLayout } as const;

export function TrayMenuCard({
  layout,
  light,
  ref,
  ...props
}: TrayCardProps & { layout: TrayMenuLayout; light: boolean; ref?: Ref<HTMLDivElement> }) {
  const text = useTranslation().trayMenu;
  const Layout = LAYOUTS[layout];
  return (
    <div
      ref={ref}
      className={`tray-card tray-card--${layout}${light ? " tray-card--light" : ""}${props.data.state.platform === "macos" ? " tray-card--mac" : ""}`}
      role="dialog"
      aria-label={text.cardName}
      data-layout={layout}
      onKeyDown={(event) => handleCardKeys(event, () => props.handlers.onAction("close"))}
    >
      <Layout {...props} />
    </div>
  );
}
