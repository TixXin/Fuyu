import { useEffect, useState } from "react";
import { SettingsInput } from "../../components/settings/SettingsInput";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useErrorText, useTranslation } from "../../i18n";
import { hasPlanConfigKey, hasPlanKey, setPlanKey, type PlanProvider } from "./api";
import type { UsageProvider } from "./usageRing";

type PlanUsageProvider = UsageProvider & { id: PlanProvider };

export const isPlan = (provider: UsageProvider): provider is PlanUsageProvider => provider.id === "glm" || provider.id === "kimi";

export function PlanKeyField({ provider }: { provider: PlanUsageProvider }) {
  const t = useTranslation();
  const text = t.claudeUsage.keys;
  const errorText = useErrorText();
  const [saved, setSaved] = useState<boolean | null>(null);
  const [fromConfig, setFromConfig] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    hasPlanKey(provider.id)
      .then((has) => !cancelled && setSaved(has))
      .catch((failure: unknown) => !cancelled && setError(errorText(failure)));
    hasPlanConfigKey(provider.id)
      .then((found) => !cancelled && setFromConfig(found))
      .catch(() => !cancelled && setFromConfig(false));
    return () => {
      cancelled = true;
    };
  }, [provider.id, errorText]);

  const save = (key: string) => {
    setSaving(true);
    setError(null);
    setPlanKey(provider.id, key)
      .then((has) => {
        setSaved(has);
        setDraft("");
      })
      .catch((failure: unknown) => setError(errorText(failure)))
      .finally(() => setSaving(false));
  };
  const label = text.label(provider.name);
  const status = error ?? (saved === null ? undefined : saved ? text.saved : fromConfig ? text.fromConfig : text.notSaved);

  return (
    <SettingsRow
      indent
      searchable={false}
      title={label}
      description={status ? <span role="status" data-plan-key-status={provider.id}>{status}</span> : undefined}
      control={
        <>
          <SettingsLinkButton disabled={saving || !draft.trim()} onClick={() => save(draft)}>{text.save}</SettingsLinkButton>
          {saved ? <SettingsLinkButton tone="danger" disabled={saving} onClick={() => save("")}>{text.clear}</SettingsLinkButton> : null}
        </>
      }
    >
      <SettingsInput
        type="password"
        autoComplete="off"
        aria-label={label}
        data-plan-key={provider.id}
        placeholder={saved ? text.savedPlaceholder : fromConfig ? text.configPlaceholder : text.emptyPlaceholder}
        value={draft}
        disabled={saving}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={(event) => event.key === "Enter" && draft.trim() && save(draft)}
      />
    </SettingsRow>
  );
}
