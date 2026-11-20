import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import type { UsageShow } from "./usageConfig.ts";
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

export function UsageStyleRows() {
  const text = useTranslation().claudeUsage.settings;
  const [config, update] = useUsageConfig();
  const hints: Partial<Record<string, string>> = {
    codex: text.codexHint,
    antigravity: text.antigravityHint,
    glm: isMacOS ? text.glmHintMac : text.glmHint,
    kimi: isMacOS ? text.kimiHintMac : text.kimiHint,
    cursor: text.cursorHint,
    workbuddy: text.workbuddyHint,
    dsh: text.dshHint,
  };
  const providers = [
    ...USAGE_PROVIDERS.map((provider) => ({ ...provider, ring: true })),
    ...HOVER_USAGE_PROVIDERS.map((provider) => ({ ...provider, ring: false })),
  ];
  return (
    <>
      {providers.map((provider) => (
        <div key={provider.id} data-usage-provider={provider.id}>
          <SettingsToggleRow
            title={
              <span className="usage-settings__title">
                <RingSwatch color={provider.color} ring={provider.ring} />
                <span>{provider.name}</span>
              </span>
            }
            description={hints[provider.id]}
            checked={config.providers[provider.id]}
            onChange={(on) => update(provider.id, on)}
          />
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
    </>
  );
}
