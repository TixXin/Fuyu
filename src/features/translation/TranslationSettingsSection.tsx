import { useState, type Dispatch, type SetStateAction, type ReactNode } from "react";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsInput } from "../../components/settings/SettingsInput";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSecretRow } from "../../components/settings/SettingsSecretRow";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useFlash } from "../../components/settings/useFlash";
import { useErrorText, useTranslation } from "../../i18n";
import { deleteTranslationSecret, saveTranslationSecret, translateText } from "./api";
import { isLoopbackCustomBaseUrl } from "./providers";
import type { TranslationSettings } from "./storage";
import { useTranslatorEngines } from "./useTranslatorEngines";
import "./TranslationSettingsSection.css";
import { isMacOS } from "../../lib/platform";

export function TranslationSettingsSection({ settings, setSettings, lead, useFooter }: {
  lead?: ReactNode;
  useFooter?: ReactNode;
  settings: TranslationSettings;
  setSettings: Dispatch<SetStateAction<TranslationSettings>>;
}) {
  const t = useTranslation();
  const errorText = useErrorText();
  const [secretDraft, setSecretDraft] = useState("");
  const [savingSecret, setSavingSecret] = useState(false);
  const [testingSecret, setTestingSecret] = useState(false);
  const [secretNotice, flashSecret] = useFlash<string>();
  const provider = settings.provider;
  const { options, hasStoredSecret, setHasSecret, error: serviceError, setError: setServiceError, isBuiltin, defaultModel } = useTranslatorEngines(provider, true, 0, settings.customBaseUrl);
  const optionalLocalSecret = provider === "custom" && isLoopbackCustomBaseUrl(settings.customBaseUrl);

  const saveSecret = async () => {
    if (!secretDraft.trim()) return;
    setSavingSecret(true);
    try {
      await saveTranslationSecret(secretDraft, provider);
      setSecretDraft("");
      setHasSecret(true);
      setServiceError("");
      flashSecret(t.translator.secretSaved);
    } catch (failure) { setServiceError(errorText(failure)); }
    finally { setSavingSecret(false); }
  };

  const removeSecret = async () => {
    try {
      await deleteTranslationSecret(provider);
      setHasSecret(false);
      setSecretDraft("");
      flashSecret(t.translator.secretDeleted);
    } catch (failure) { setServiceError(errorText(failure)); }
  };

  const testSecret = async () => {
    setTestingSecret(true);
    setServiceError("");
    try {
      if (secretDraft.trim()) {
        await saveTranslationSecret(secretDraft, provider);
        setSecretDraft("");
        setHasSecret(true);
      }
      await translateText("Hello", "en-zh", {
        provider,
        baseUrl: provider === "custom" ? settings.customBaseUrl.trim() || null : null,
        model: settings.models[provider]?.trim() || null,
      });
      flashSecret(t.translator.testOk);
    } catch (failure) {
      setServiceError(errorText(failure));
    } finally {
      setTestingSecret(false);
    }
  };

  const footer = serviceError ? (
    <span className="translation-settings__error" role="alert">{serviceError}</span>
  ) : (
    <SettingsFootnote text={isMacOS ? t.translator.credentialHintMac : t.translator.credentialHint} />
  );

  return (
    <>
      <SettingsGroup title={t.settings.translation.behaviorTitle} footer={useFooter}>
        {lead}
        <SettingsToggleRow title={t.settings.translation.pasteOnOpen} description={t.settings.translation.pasteOnOpenHint} checked={settings.pasteClipboardOnOpen} onChange={(pasteClipboardOnOpen) => setSettings((current) => ({ ...current, pasteClipboardOnOpen }))} />
        <SettingsToggleRow title={t.settings.translation.autoTranslate} description={t.settings.translation.autoTranslateHint} checked={settings.autoTranslate} onChange={(autoTranslate) => setSettings((current) => ({ ...current, autoTranslate }))} />
      </SettingsGroup>
      <SettingsGroup title={t.settings.translation.serviceTitle} footer={footer}>
        <SettingsRow
          title={t.translator.provider}
          control={
            <SettingsSelect
              value={provider}
              options={options}
              ariaLabel={t.translator.provider}
              onChange={(next) => {
                setSecretDraft("");
                setServiceError("");
                setSettings((current) => ({ ...current, provider: next }));
              }}
            />
          }
        />
        {provider === "custom" && (
          <SettingsRow title={t.translator.baseUrl} description={t.translator.baseUrlHint}>
            <SettingsInput type="url" monospace autoComplete="off" aria-label={t.translator.baseUrl} value={settings.customBaseUrl} placeholder="https://example.com/v1" onChange={(event) => { const customBaseUrl = event.currentTarget.value; setSettings((current) => ({ ...current, customBaseUrl })); }} />
          </SettingsRow>
        )}
        <SettingsRow title={t.translator.model}>
          <SettingsInput monospace autoComplete="off" aria-label={t.translator.model} value={settings.models[provider] ?? ""} placeholder={defaultModel ? t.translator.modelDefault(defaultModel) : t.translator.modelRequired} onChange={(event) => { const model = event.currentTarget.value; setSettings((current) => ({ ...current, models: { ...current.models, [provider]: model } })); }} />
        </SettingsRow>
        {isBuiltin && (
          <SettingsSecretRow
            title={t.translator.secret}
            description={secretNotice ? <span role="status">{secretNotice}</span> : hasStoredSecret ? t.common.saved : optionalLocalSecret ? t.translator.optionalLocalSecret : undefined}
            value={secretDraft}
            placeholder={hasStoredSecret ? t.translator.replaceSecret : optionalLocalSecret ? t.translator.enterOptionalSecret : t.translator.enterSecret}
            ariaLabel={t.translator.secret}
            hasSecret={hasStoredSecret}
            saving={savingSecret}
            testing={testingSecret}
            saveLabel={t.translator.saveSecret}
            deleteLabel={t.translator.deleteSecret}
            testLabel={testingSecret ? t.translator.testingSecret : t.translator.testSecret}
            onChange={setSecretDraft}
            onSave={() => void saveSecret()}
            onDelete={() => void removeSecret()}
            onTest={hasStoredSecret || optionalLocalSecret || Boolean(secretDraft.trim()) ? () => void testSecret() : undefined}
          />
        )}
      </SettingsGroup>
    </>
  );
}
