import { useTranslation } from "../../../i18n";
import { SettingsChoice } from "../../../components/settings/SettingsChoice";
import { SettingsColor } from "../../../components/settings/SettingsColor";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
import type { IslandSettings, TuckHintColor, TuckHintStyle } from "../../../lib/settings/types";

export function TuckHintRows({
  settings,
  update,
}: {
  settings: IslandSettings;
  update: (patch: Partial<IslandSettings>) => void;
}) {
  const expand = useTranslation().settings.expand;
  const styles: { value: TuckHintStyle; label: string }[] = [
    { value: "none", label: expand.tuckHintNone },
    { value: "dot", label: expand.tuckHintDot },
    { value: "glow", label: expand.tuckHintGlow },
  ];
  const colors: { value: TuckHintColor; label: string }[] = [
    { value: "contrast", label: expand.tuckHintColorContrast },
    { value: "island", label: expand.tuckHintColorIsland },
    { value: "custom", label: expand.tuckHintColorCustom },
  ];
  const shown = settings.tuckHintStyle !== "none";

  return (
    <>
      <SettingsRow
        indent
        title={expand.tuckHint}
        description={expand.tuckHintHint}
        control={
          <SettingsChoice
            value={settings.tuckHintStyle}
            options={styles}
            ariaLabel={expand.tuckHint}
            onChange={(tuckHintStyle) => update({ tuckHintStyle })}
          />
        }
      />
      {shown && (
        <SettingsRow
          indent
          title={expand.tuckHintColor}
          control={
            <SettingsChoice
              value={settings.tuckHintColor}
              options={colors}
              ariaLabel={expand.tuckHintColor}
              onChange={(tuckHintColor) => update({ tuckHintColor })}
            />
          }
        />
      )}
      {shown && settings.tuckHintColor === "custom" && (
        <SettingsRow
          indent
          title={expand.tuckHintCustomColor}
          control={
            <SettingsColor
              value={settings.tuckHintCustomColor}
              ariaLabel={expand.tuckHintCustomColor}
              onChange={(tuckHintCustomColor) => update({ tuckHintCustomColor })}
            />
          }
        />
      )}
      {shown && (
        <SettingsToggleRow
          indent
          title={expand.tuckHintBreathe}
          description={expand.tuckHintBreatheHint}
          checked={settings.tuckHintBreathe}
          onChange={(tuckHintBreathe) => update({ tuckHintBreathe })}
        />
      )}
    </>
  );
}
