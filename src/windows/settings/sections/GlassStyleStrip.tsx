import type { CSSProperties } from "react";
import { SettingsThumbStrip } from "../../../components/settings/SettingsThumbStrip";
import { useTranslation } from "../../../i18n";
import type { GlassPalette } from "../../../lib/theme/glassPalette";
import { GLASS_STYLES, type GlassSettingValues } from "../../../lib/settings/glassSettings";
import "./GlassStyleStrip.css";

type GlassStyle = GlassSettingValues["glassStyle"];

function GlassArt({ style, palette, live }: { style: GlassStyle; palette: GlassPalette; live: boolean }) {
  const colors = { "--glass-art-1": palette[0], "--glass-art-2": palette[1], "--glass-art-3": palette[2] } as CSSProperties;
  const className = `glass-art glass-art--${style}${live ? " glass-art--live" : ""}`;
  return (
    <span className={className} style={colors}>
      <span className="glass-art__layer glass-art__layer--a" />
      <span className="glass-art__layer glass-art__layer--b" />
      <span className="glass-art__sheen" />
    </span>
  );
}

export function GlassStyleStrip({ value, palette, onChange }: {
  value: GlassStyle;
  palette: GlassPalette;
  onChange: (style: GlassStyle) => void;
}) {
  const text = useTranslation().settings.appearance.glass;
  const options = GLASS_STYLES.map((style) => ({
    value: style,
    label: text.styles[style],
    hint: style === "shader" ? text.shaderHint : text.styleHints[style],
  }));
  return (
    <SettingsThumbStrip<GlassStyle>
      options={options}
      value={value}
      ariaLabel={text.style}
      renderArt={(style, live) => <GlassArt style={style} palette={palette} live={live} />}
      onChange={onChange}
    />
  );
}
