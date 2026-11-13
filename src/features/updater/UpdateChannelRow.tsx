import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useTranslation } from "../../i18n";
import type { UpdateChannel } from "./storage";
import { setUpdateChannel } from "./updaterController";

export function UpdateChannelRow({ channel, disabled }: { channel: UpdateChannel; disabled: boolean }) {
  const text = useTranslation().settings.project.update;

  return (
    <SettingsRow
      title={text.channel}
      description={channel === "beta" ? text.channelBetaHint : text.channelStableHint}
      control={
        <SettingsChoice
          value={channel}
          options={[
            { value: "stable", label: text.channelStable },
            { value: "beta", label: text.channelBeta },
          ]}
          ariaLabel={text.channel}
          disabled={disabled}
          onChange={(next) => void setUpdateChannel(next)}
        />
      }
    />
  );
}
