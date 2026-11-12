import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import type { ExpandTrigger, IslandSettings } from "../../features/appearance/types";
import type { ClipboardHistorySettings } from "../../features/clipboard/api";
import { useTranslation } from "../../i18n";

/** Step 3: how the island opens and hides, Win+V, and starting with Windows. */
export function HabitsStep({ settings, clipboard, launchAtStartup, onSettingsChange, onClipboardChange, onLaunchAtStartupChange }: {
  settings: IslandSettings;
  clipboard: ClipboardHistorySettings;
  launchAtStartup: boolean;
  onSettingsChange: (settings: IslandSettings) => void;
  onClipboardChange: (settings: ClipboardHistorySettings) => void;
  onLaunchAtStartupChange: (enabled: boolean) => void;
}) {
  const text = useTranslation().onboarding.habits;

  return (
    <SettingsGroup>
      <SettingsRow
        title={text.expand}
        description={text.expandHint}
        control={
          <SettingsChoice<ExpandTrigger>
            value={settings.expandTrigger}
            ariaLabel={text.expand}
            options={[
              { value: "hover", label: text.hover },
              { value: "click", label: text.click },
            ]}
            onChange={(expandTrigger) => onSettingsChange({ ...settings, expandTrigger })}
          />
        }
      />
      <SettingsToggleRow
        title={text.autoTuck}
        description={text.autoTuckHint}
        checked={settings.autoTuck}
        onChange={(autoTuck) => onSettingsChange({ ...settings, autoTuck })}
      />
      {clipboard.enabled && (
        <SettingsToggleRow
          title={text.winV}
          description={text.winVHint}
          checked={clipboard.winV}
          onChange={(winV) => onClipboardChange({ ...clipboard, winV })}
        />
      )}
      <SettingsToggleRow
        title={text.launchAtStartup}
        description={text.launchAtStartupHint}
        checked={launchAtStartup}
        onChange={onLaunchAtStartupChange}
      />
    </SettingsGroup>
  );
}
