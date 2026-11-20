import { SettingsChoiceCards } from "../../../components/settings/SettingsChoiceCards";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { islandItemStyleId, islandItemStyles, type IslandItemStyleProps } from "../../../features/plugin-kernel/settingsSlots";
import { useTranslation } from "../../../i18n";
import type { AgentLightStyle } from "../../../lib/settings/types";
import { StatusLightStyleArt } from "./StatusLightStyleArt";

function StatusLightStyleRows({ settings, onSettingsChange }: IslandItemStyleProps) {
  const text = useTranslation().settings.agent;
  return (
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
  );
}

islandItemStyles.add({ id: islandItemStyleId("status-light"), category: "islandLayout", order: 10, component: StatusLightStyleRows });
