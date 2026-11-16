import { useEffect, useState } from "react";
import { useTranslation } from "../../../i18n";
import { isMacOS } from "../../../lib/platform";
import { SettingsChoiceCards } from "../../../components/settings/SettingsChoiceCards";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { TRAY_MENU_LAYOUTS, TRAY_MENU_LAYOUT_KEY, loadTrayMenuLayout, saveTrayMenuLayout, type TrayMenuLayout } from "../../tray-menu/storage";
import "./TrayCardLayoutRow.css";

const GLYPH_ROWS: Record<TrayMenuLayout, readonly string[]> = {
  entry: ["head", "tiles", "strip", "line", "line", "foot"],
  status: ["head", "block", "block", "pills", "foot"],
  compact: ["head", "tiles", "line", "line"],
};

function TrayCardGlyph({ layout }: { layout: TrayMenuLayout }) {
  return (
    <span className="tray-card-glyph">
      {GLYPH_ROWS[layout].map((row, index) => (
        <span key={index} className={`tray-card-glyph__${row}`} />
      ))}
    </span>
  );
}

export function TrayCardLayoutRow({ trayIconVisible }: { trayIconVisible: boolean }) {
  const text = useTranslation().settings.layout;
  const [layout, setLayout] = useState(loadTrayMenuLayout);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === TRAY_MENU_LAYOUT_KEY || event.key === null) setLayout(loadTrayMenuLayout());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const title = isMacOS ? text.trayCardMac : text.trayCard;
  const hint = trayIconVisible
    ? isMacOS ? text.trayCardHintMac : text.trayCardHint
    : isMacOS ? text.trayCardOffHintMac : text.trayCardOffHint;
  return (
    <SettingsRow title={title} description={hint} indent>
      <fieldset className="tray-card-layout" disabled={!trayIconVisible}>
        <SettingsChoiceCards<TrayMenuLayout>
          value={layout}
          ariaLabel={title}
          options={TRAY_MENU_LAYOUTS.map((value) => ({
            value,
            label: text.trayCardLayouts[value].label,
            hint: text.trayCardLayouts[value].hint,
            art: <TrayCardGlyph layout={value} />,
          }))}
          onChange={(next) => {
            setLayout(next);
            saveTrayMenuLayout(next);
          }}
        />
      </fieldset>
    </SettingsRow>
  );
}
