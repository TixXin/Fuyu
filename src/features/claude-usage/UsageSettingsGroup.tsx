import { useEffect, useId, useState } from "react";
import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsInput } from "../../components/settings/SettingsInput";
import { SettingsNumberRow } from "../../components/settings/SettingsNumberRow";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSwitch } from "../../components/settings/SettingsSwitch";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import { switchBuiltinPlugin } from "../plugin-kernel/builtinSwitches";
import { OWNER } from "./plugin/owner.ts";
import { isPlan, PlanKeyField } from "./PlanKeyFields";
import { USAGE_INTERVAL, type UsageShow } from "./usageConfig.ts";
import { HOVER_USAGE_PROVIDERS, USAGE_PROVIDERS } from "./usageRing";
import { useUsageConfig } from "./useUsageConfig";
import "./UsageSettingsGroup.css";

function RingSwatch({ color, ring = true }: { color: string; ring?: boolean }) {
  if (!ring) {
    return (
      <span className="usage-settings__swatch" aria-hidden="true">
        <span className="usage-settings__dot" style={{ background: color }} />
      </span>
    );
  }
  return (
    <svg className="usage-settings__swatch" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.2" fill="none" stroke="var(--color-white-a12)" strokeWidth="2" />
      <circle cx="8" cy="8" r="6.2" fill="none" stroke={color} strokeWidth="2" strokeDasharray="24 40" strokeLinecap="round" transform="rotate(-90 8 8)" />
      <circle cx="8" cy="8" r="3.2" fill="none" stroke={color} strokeWidth="1.8" strokeOpacity="0.78" strokeDasharray="12 24" strokeLinecap="round" transform="rotate(-90 8 8)" />
    </svg>
  );
}

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
  const hints: Partial<Record<string, string>> = {
    codex: text.codexHint,
    antigravity: text.antigravityHint,
    glm: isMacOS ? text.glmHintMac : text.glmHint,
    kimi: isMacOS ? text.kimiHintMac : text.kimiHint,
    workbuddy: text.workbuddyHint,
    dsh: text.dshHint,
  };
  return (
    <>
      <SettingsGroup
        title={text.title}
        action={<SettingsSwitch id={switchId} ariaLabel={text.title} checked onChange={(on) => void switchBuiltinPlugin(OWNER, on).catch(() => undefined)} />}
        footer={<SettingsFootnote text={text.footer} />}
      >
        {USAGE_PROVIDERS.map((provider) => (
          <div key={provider.id} data-usage-provider={provider.id}>
            <SettingsToggleRow
              title={
                <span className="usage-settings__title">
                  <RingSwatch color={provider.color} />
                  <span>{provider.name}</span>
                </span>
              }
              description={hints[provider.id]}
              checked={config.providers[provider.id]}
              onChange={(on) => update(provider.id, on)}
            />
            {config.providers[provider.id] && isPlan(provider) ? <PlanKeyField provider={provider} /> : null}
          </div>
        ))}
        {HOVER_USAGE_PROVIDERS.map((provider) => (
          <div key={provider.id} data-usage-provider={provider.id}>
            <SettingsToggleRow
              title={
                <span className="usage-settings__title">
                  <RingSwatch color={provider.color} ring={false} />
                  <span>{provider.name}</span>
                </span>
              }
              description={hints[provider.id]}
              checked={config.providers[provider.id]}
              onChange={(on) => update(provider.id, on)}
            />
          </div>
        ))}
      </SettingsGroup>

      <SettingsGroup title={text.optionsTitle}>
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
    </>
  );
}
