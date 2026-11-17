import { useEffect, useState } from "react";
import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsInput } from "../../components/settings/SettingsInput";
import { SettingsNumberRow } from "../../components/settings/SettingsNumberRow";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import { isPlan, PlanKeyField } from "./PlanKeyFields";
import { USAGE_INTERVAL, type UsageShow } from "./usageConfig.ts";
import { HOVER_USAGE_PROVIDERS, USAGE_PROVIDERS } from "./usageRing";
import { useUsageConfig } from "./useUsageConfig";

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
  const t = useTranslation();
  const text = t.claudeUsage.settings;
  const [config, update] = useUsageConfig();
  const hints: Partial<Record<string, string>> = {
    codex: text.codexHint,
    antigravity: text.antigravityHint,
    glm: isMacOS ? text.glmHintMac : text.glmHint,
    kimi: isMacOS ? text.kimiHintMac : text.kimiHint,
    workbuddy: text.workbuddyHint,
    dsh: text.dshHint,
  };
  return (
    <SettingsGroup title={text.title} footer={text.footer}>
      {USAGE_PROVIDERS.map((provider) => (
        <div key={provider.id} data-usage-provider={provider.id}>
          <SettingsToggleRow title={provider.name} description={hints[provider.id]} checked={config.providers[provider.id]} onChange={(on) => update(provider.id, on)} />
          {config.providers[provider.id] && isPlan(provider) ? <PlanKeyField provider={provider} /> : null}
        </div>
      ))}
      {HOVER_USAGE_PROVIDERS.map((provider) => (
        <div key={provider.id} data-usage-provider={provider.id}>
          <SettingsToggleRow title={provider.name} description={hints[provider.id]} checked={config.providers[provider.id]} onChange={(on) => update(provider.id, on)} />
        </div>
      ))}
      <SettingsRow
        title={text.show}
        control={
          <SettingsChoice<UsageShow>
            value={config.show}
            ariaLabel={text.show}
            options={[
              { value: "used", label: text.used },
              { value: "remaining", label: text.remaining },
            ]}
            onChange={(show) => update("show", show)}
          />
        }
      />
      <SettingsToggleRow title={text.askAnthropic} description={text.askAnthropicHint} checked={config.askAnthropic} onChange={(on) => update("askAnthropic", on)} />
      {config.askAnthropic ? (
        <>
          <ProxyRow proxy={config.proxy} onChange={(proxy) => update("proxy", proxy)} />
          <SettingsNumberRow indent title={text.interval} value={config.intervalMinutes} min={USAGE_INTERVAL.min} max={USAGE_INTERVAL.max} unit={text.minutes} onChange={(minutes) => update("intervalMinutes", minutes)} />
        </>
      ) : null}
    </SettingsGroup>
  );
}
