import { useEffect, useId, useState } from "react";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsInput } from "../../components/settings/SettingsInput";
import { SettingsNumberRow } from "../../components/settings/SettingsNumberRow";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSwitch } from "../../components/settings/SettingsSwitch";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import { IslandPlacementRow } from "../plugin-kernel/IslandPlacementRow";
import { switchBuiltinPlugin } from "../plugin-kernel/builtinSwitches";
import { OWNER } from "./plugin/owner.ts";
import { isPlan, PlanKeyField } from "./PlanKeyFields";
import { USAGE_INTERVAL } from "./usageConfig.ts";
import { USAGE_PROVIDERS } from "./usageRing";
import { useUsageConfig } from "./useUsageConfig";
import "./UsageSettingsGroup.css";

function ProxyRow({ proxy, onChange }: { proxy: string; onChange: (proxy: string) => void }) {
  const text = useTranslation().claudeUsage.settings;
  const [draft, setDraft] = useState(proxy);
  useEffect(() => setDraft(proxy), [proxy]);
  const commit = () => draft.trim() !== proxy && onChange(draft.trim());
  return (
    <SettingsRow indent title={text.proxy} description={isMacOS ? text.proxyHintMac : text.proxyHint}>
      <SettingsInput
        type="url"
        monospace
        autoComplete="off"
        aria-label={text.proxy}
        placeholder="http://127.0.0.1:7890"
        value={draft}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(event) => event.key === "Enter" && commit()}
      />
    </SettingsRow>
  );
}

export function UsageSettingsGroup() {
  const switchId = useId();
  const t = useTranslation();
  const text = t.claudeUsage.settings;
  const [config, update] = useUsageConfig();
  return (
    <>
      <SettingsGroup
        title={text.title}
        action={<SettingsSwitch id={switchId} ariaLabel={text.title} checked onChange={(on) => void switchBuiltinPlugin(OWNER, on).catch(() => undefined)} />}
        footer={<SettingsFootnote text={text.footer} />}
      >
        <IslandPlacementRow item="usage:" />
        {USAGE_PROVIDERS.filter(isPlan).filter((provider) => config.providers[provider.id]).map((provider) => <PlanKeyField key={provider.id} provider={provider} />)}
      </SettingsGroup>

      <SettingsGroup title={text.optionsTitle}>
        <SettingsToggleRow title={text.askAnthropic} description={text.askAnthropicHint} checked={config.askAnthropic} onChange={(on) => update("askAnthropic", on)} />
        {config.askAnthropic ? (
          <>
            <ProxyRow proxy={config.proxy} onChange={(proxy) => update("proxy", proxy)} />
            <SettingsNumberRow indent title={text.interval} value={config.intervalMinutes} min={USAGE_INTERVAL.min} max={USAGE_INTERVAL.max} unit={text.minutes} onChange={(minutes) => update("intervalMinutes", minutes)} />
          </>
        ) : null}
      </SettingsGroup>
    </>
  );
}
