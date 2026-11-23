import { SettingsChoiceCards } from "../../../components/settings/SettingsChoiceCards";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
import { islandItemStyleId, islandItemStyles, type IslandItemStyleProps } from "../../../features/plugin-kernel/settingsSlots";
import { useTranslation } from "../../../i18n";
import { JELLYFISH_STYLES } from "../../../lib/settings/settingsLimits";
import type { AgentLightStyle, JellyfishStyle } from "../../../lib/settings/types";
import { JellyfishStyleArt } from "./JellyfishStyleArt";
import { StatusLightStyleArt } from "./StatusLightStyleArt";

function StatusLightStyleRows({ settings, onSettingsChange }: IslandItemStyleProps) {
  const text = useTranslation().settings.agent;
  return (
    <>
      <SettingsRow title={text.lightStyle} description={text.lightStyleHint}>
        <SettingsChoiceCards<AgentLightStyle>
          value={settings.agentLightStyle}
          ariaLabel={text.lightStyle}
          options={[
            { value: "mark", label: text.lightStyleOptions.mark, hint: text.lightStyleHints.mark, art: <StatusLightStyleArt style="mark" /> },
            { value: "dot", label: text.lightStyleOptions.dot, hint: text.lightStyleHints.dot, art: <StatusLightStyleArt style="dot" /> },
          ]}
          onChange={(agentLightStyle) => onSettingsChange({ ...settings, agentLightStyle })}
        />
      </SettingsRow>
      <SettingsRow title={text.jellyStyle} description={text.jellyStyleHint}>
        <SettingsChoiceCards<JellyfishStyle>
          value={settings.jellyfishStyle}
          ariaLabel={text.jellyStyle}
          options={JELLYFISH_STYLES.map((value) => ({ value, label: text.jellyStyleOptions[value], hint: text.jellyStyleHints[value], art: <JellyfishStyleArt style={value} /> }))}
          onChange={(jellyfishStyle) => onSettingsChange({ ...settings, jellyfishStyle })}
        />
      </SettingsRow>
      <SettingsToggleRow
        title={text.jellyDoze}
        description={text.jellyDozeHint}
        checked={settings.jellyfishNightDoze}
        onChange={(jellyfishNightDoze) => onSettingsChange({ ...settings, jellyfishNightDoze })}
      />
    </>
  );
}

islandItemStyles.add({ id: islandItemStyleId("status-light"), category: "islandLayout", order: 10, component: StatusLightStyleRows });
