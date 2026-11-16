import { Clipboard, Languages, ScanLine } from "lucide-react";
import { useTranslation } from "../../i18n";
import { shortcutLabel } from "../../lib/shortcut/shortcut";
import type { TrayCardProps } from "./types";

export type TrayFeature = "screenshot" | "translate" | "clipboard";

const ICONS = { screenshot: ScanLine, translate: Languages, clipboard: Clipboard } as const;

function featureOn(feature: TrayFeature, state: TrayCardProps["data"]["state"]) {
  if (feature === "screenshot") return state.screenshotEnabled;
  if (feature === "translate") return state.translateEnabled;
  return true;
}

export function FeatureButton({
  feature,
  variant,
  showShortcut,
  data,
  handlers,
}: TrayCardProps & { feature: TrayFeature; variant: "tile" | "pill"; showShortcut: boolean }) {
  const text = useTranslation().trayMenu;
  const Icon = ICONS[feature];
  const label = text[feature];
  const on = featureOn(feature, data.state);
  const raw = data.shortcuts[feature];
  const shortcut = raw ? shortcutLabel(raw, data.state.platform === "macos") : "";
  const name = [label, on ? shortcut : text.off].filter(Boolean).join(text.separator);
  const tip = on ? [label, shortcut].filter(Boolean).join("  ") : text.offHint(label);
  return (
    <button
      type="button"
      className={`tray-card__${variant}${on ? "" : ` tray-card__${variant}--off`}`}
      aria-disabled={on ? undefined : true}
      aria-label={name}
      title={tip}
      onClick={() => handlers.onAction(on ? feature : "open_settings")}
    >
      <Icon size={16} aria-hidden="true" />
      <span className="tray-card__label">{label}</span>
      {variant === "tile" && !on ? <span className="tray-card__off">{text.off}</span> : null}
      {variant === "tile" && on && showShortcut && shortcut ? <kbd>{shortcut}</kbd> : null}
    </button>
  );
}
