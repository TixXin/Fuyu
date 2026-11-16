import { ClipboardX, Power, Settings } from "lucide-react";
import { useTranslation } from "../../i18n";
import { columns, entryShown, shownFeatures } from "./builtinEntries";
import { FeatureButton } from "./FeatureButton";
import { IslandButton } from "./IslandButton";
import { TrayCardHeader } from "./TrayCardHeader";
import { TraySwitch } from "./TraySwitch";
import type { TrayCardProps } from "./types";

export function CompactLayout(props: TrayCardProps) {
  const text = useTranslation().trayMenu;
  const { data, handlers } = props;
  const features = shownFeatures(data.off, ["screenshot", "translate", "clipboard"]);
  return (
    <>
      <TrayCardHeader {...props} />
      <div className="tray-card__compact-row" style={columns(features.length + 1)}>
        <IslandButton variant="tile" {...props} />
        {features.map((feature) => <FeatureButton key={feature} feature={feature} variant="tile" showShortcut={false} {...props} />)}
      </div>
      <div className="tray-card__menu">
        {entryShown(data.off, "clipboard") ? (
        <TraySwitch
          className="tray-card__menu-row"
          label={text.clipPaused}
          icon={<ClipboardX size={16} aria-hidden="true" />}
          checked={data.state.clipboardPaused}
          onToggle={() => handlers.onAction("toggle_clipboard_pause")}
        />
        ) : null}
        <button type="button" className="tray-card__menu-row" onClick={() => handlers.onAction("open_settings")}>
          <Settings size={16} aria-hidden="true" />
          <span>{text.settings}…</span>
        </button>
        <button type="button" className="tray-card__menu-row tray-card__menu-row--danger" onClick={() => handlers.onAction("quit")}>
          <Power size={16} aria-hidden="true" />
          <span>{text.quit}</span>
        </button>
      </div>
    </>
  );
}
