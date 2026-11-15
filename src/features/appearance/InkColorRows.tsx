import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsColor } from "../../components/settings/SettingsColor";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useTranslation } from "../../i18n";
import { HEX_COLOR_PATTERN, relativeLuminance } from "../../utils/color";
import { autoInkHex } from "./themeMode";
import type { IslandSettings } from "./types";

type InkMode = "auto" | "custom";

const READABLE_CONTRAST = 4.5;

export function InkColorRows({ settings, onSettingsChange }: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const text = useTranslation().settings.colors;
  const custom = HEX_COLOR_PATTERN.test(settings.inkColor);
  const ratio = custom ? contrast(settings.inkColor, settings.islandBackgroundColor) : 0;
  const setInk = (inkColor: string) => onSettingsChange({ ...settings, inkColor });
  return (
    <>
      <SettingsRow
        title={text.ink}
        description={text.inkHint}
        control={
          <SettingsChoice<InkMode>
            value={custom ? "custom" : "auto"}
            ariaLabel={text.ink}
            options={(["auto", "custom"] as const).map((mode) => ({ value: mode, label: text.inkModes[mode] }))}
            onChange={(mode) => setInk(mode === "custom" ? autoInkHex(settings.islandBackgroundColor) : "")}
          />
        }
      />
      {custom && (
        <SettingsRow
          indent
          title={text.inkColor}
          description={ratio < READABLE_CONTRAST ? text.inkLowContrast(ratio.toFixed(1)) : undefined}
          control={
            <>
              <SettingsColor value={settings.inkColor} ariaLabel={text.inkColor} onChange={setInk} />
              <SettingsLinkButton onClick={() => setInk("")}>{text.inkReset}</SettingsLinkButton>
            </>
          }
        />
      )}
    </>
  );
}

function contrast(a: string, b: string) {
  const [high, low] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}
