import { useTranslation } from "../../../i18n";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsThumbStrip } from "../../../components/settings/SettingsThumbStrip";
import { useReducedMotion } from "../../../lib/theme/useReducedMotion";
import { ISLAND_HOVERS } from "../../../lib/theme/islandHover";
import type { IslandBounce, IslandHover } from "../../../lib/settings/types";
import { HoverThumb } from "./motion/HoverThumb";
import { useThumbPointer } from "./useThumbPointer";
import "./IslandHoverRow.css";

export function IslandHoverRow({ value, bounce, islandColor, onChange }: { value: IslandHover; bounce: IslandBounce; islandColor: string; onChange: (value: IslandHover) => void }) {
  const text = useTranslation().settings.expand;
  const reducedMotion = useReducedMotion();
  const { pointed, handlers } = useThumbPointer();
  const labels: Record<IslandHover, string> = {
    bounce: text.hoverBounce,
    near: text.hoverNear,
    subtle: text.hoverSubtle,
    bold: text.hoverBold,
    drop: text.hoverDrop,
    touch: text.hoverTouch,
    none: text.hoverNone,
  };

  return (
    <SettingsRow className="island-hover-row" title={text.hoverEffect} description={text.hoverMotionHint}>
      <div className="island-hover-row__strip" {...handlers}>
        <SettingsThumbStrip<IslandHover>
          options={ISLAND_HOVERS.map((hover) => ({ value: hover, label: labels[hover], hint: text.hoverHints[hover] }))}
          value={value}
          ariaLabel={text.hoverEffect}
          onChange={onChange}
          renderArt={(hover) => <HoverThumb hover={hover} bounce={bounce} play={!reducedMotion && pointed === hover} islandColor={islandColor} />}
        />
      </div>
    </SettingsRow>
  );
}
