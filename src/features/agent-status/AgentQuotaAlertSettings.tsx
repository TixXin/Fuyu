import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useTranslation } from "../../i18n";
import type { IslandSettings } from "../../lib/settings/types";
import { AGENT_QUOTA_ALERT_PERCENTS } from "./agentSettings";

export function AgentQuotaAlertSettings({
  settings,
  onSettingsChange,
}: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const text = useTranslation().settings.agent.alerts;
  const quotaOptions = AGENT_QUOTA_ALERT_PERCENTS.map((percent) => ({ value: String(percent), label: text.quotaValue(percent) }));

  return (
    <SettingsGroup title={text.quotaSectionTitle}>
      <SettingsRow
        title={text.quota}
        description={text.quotaDescription}
        control={
          <SettingsChoice
            value={String(settings.agentQuotaAlertPercent)}
            options={quotaOptions}
            ariaLabel={text.quota}
            onChange={(value) => onSettingsChange({ ...settings, agentQuotaAlertPercent: Number(value) })}
          />
        }
      />
    </SettingsGroup>
  );
}
