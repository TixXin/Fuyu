import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";
import { SESSION_RING_STYLES, type SessionRingStyle } from "./ringConfig.ts";
import { useRingConfig } from "./useRingConfig";

export function RingSettingsGroup() {
  const text = useTranslation().sessionRing.settings;
  const [config, update] = useRingConfig();
  return (
    <SettingsGroup title={text.title} footer={text.footer}>
      <SettingsRow
        title={text.style}
        control={
          <SettingsSelect<SessionRingStyle>
            value={config.style}
            ariaLabel={text.style}
            options={SESSION_RING_STYLES.map((style) => ({ value: style, label: text.styles[style] }))}
            onChange={(style) => update("style", style)}
          />
        }
      />
      <SettingsToggleRow title={text.showCount} description={text.showCountHint} checked={config.showCount} onChange={(on) => update("showCount", on)} />
    </SettingsGroup>
  );
}
