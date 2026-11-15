import { useEffect, useState } from "react";
import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsInput } from "../../components/settings/SettingsInput";
import { SettingsNumberRow } from "../../components/settings/SettingsNumberRow";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import type { ClipboardHistorySettings, ClipboardSecretHandling } from "./api";
import { CLIPBOARD_MAX_ITEMS, CLIPBOARD_MIN_ITEMS, CLIPBOARD_RETENTION_DAYS, parseExcludedApps } from "./settings";
import { CLIPBOARD_SECRET_EXPIRY_MINUTES, CLIPBOARD_TEXT_LIMITS_KB } from "./privacySettings";

export function ClipboardRecordSettings({ clipboardSettings, onChange }: {
  clipboardSettings: ClipboardHistorySettings;
  onChange: (patch: Partial<ClipboardHistorySettings>) => void;
}) {
  const t = useTranslation();
  const text = t.settings.clipboard;
  const privacy = t.clipboardPrivacy;
  const savedApps = clipboardSettings.excludedApps.join(", ");
  const [apps, setApps] = useState(savedApps);
  useEffect(() => setApps(savedApps), [savedApps]);

  return (
    <SettingsGroup title={text.title}>
      <SettingsToggleRow title={text.captureImages} checked={clipboardSettings.captureImages} onChange={(captureImages) => onChange({ captureImages })} />
      {clipboardSettings.captureImages && (
        <SettingsToggleRow indent title={text.ocr} description={isMacOS ? text.ocrHintMac : text.ocrHint} checked={clipboardSettings.ocr} onChange={(ocr) => onChange({ ocr })} />
      )}
      <SettingsToggleRow title={text.captureFiles} description={isMacOS ? text.captureFilesHintMac : text.captureFilesHint} checked={clipboardSettings.captureFiles} onChange={(captureFiles) => onChange({ captureFiles })} />
      <SettingsToggleRow title={text.captureHtml} description={isMacOS ? text.captureHtmlHintMac : text.captureHtmlHint} checked={clipboardSettings.captureHtml} onChange={(captureHtml) => onChange({ captureHtml })} />
      <SettingsToggleRow title={text.skipSensitive} description={isMacOS ? text.skipSensitiveHintMac : text.skipSensitiveHint} checked={clipboardSettings.skipSensitive} onChange={(skipSensitive) => onChange({ skipSensitive })} />
      {isMacOS && (
        <SettingsToggleRow title={privacy.recordRemote} description={privacy.recordRemoteHint} checked={clipboardSettings.recordRemote} onChange={(recordRemote) => onChange({ recordRemote })} />
      )}
      <SettingsToggleRow title={privacy.forgetCleared} description={privacy.forgetClearedHint} checked={clipboardSettings.forgetCleared} onChange={(forgetCleared) => onChange({ forgetCleared })} />
      <SettingsRow
        title={text.secrets}
        description={text.secretsHint}
        control={
          <SettingsChoice<ClipboardSecretHandling>
            value={clipboardSettings.secrets}
            ariaLabel={text.secrets}
            options={[
              { value: "mask", label: text.secretsOptions.mask },
              { value: "skip", label: text.secretsOptions.skip },
              { value: "keep", label: text.secretsOptions.keep },
            ]}
            onChange={(secrets) => onChange({ secrets })}
          />
        }
      />
      {clipboardSettings.secrets === "mask" && (
        <SettingsRow
          indent
          title={privacy.secretExpiry}
          description={privacy.secretExpiryHint}
          control={
            <SettingsSelect
              value={String(clipboardSettings.secretExpiryMinutes)}
              ariaLabel={privacy.secretExpiry}
              options={CLIPBOARD_SECRET_EXPIRY_MINUTES.map((minutes) => ({ value: String(minutes), label: privacy.secretExpiryOption(minutes) }))}
              onChange={(value) => onChange({ secretExpiryMinutes: Number(value) })}
            />
          }
        />
      )}
      <SettingsRow title={text.excludedApps} description={isMacOS ? text.excludedAppsHintMac : text.excludedAppsHint} labelFor="clipboard-excluded-apps">
        <SettingsInput
          id="clipboard-excluded-apps"
          value={apps}
          placeholder={isMacOS ? "1Password.app, Bitwarden.app" : "keepass.exe, 1password.exe"}
          onChange={(event) => setApps(event.currentTarget.value)}
          onBlur={() => onChange({ excludedApps: parseExcludedApps(apps) })}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
      </SettingsRow>
      <SettingsRow
        title={privacy.maxText}
        description={privacy.maxTextHint}
        control={
          <SettingsSelect
            value={String(clipboardSettings.maxTextKb)}
            ariaLabel={privacy.maxText}
            options={CLIPBOARD_TEXT_LIMITS_KB.map((kb) => ({ value: String(kb), label: privacy.maxTextOption(kb) }))}
            onChange={(value) => onChange({ maxTextKb: Number(value) })}
          />
        }
      />
      <SettingsToggleRow title={text.localApiRead} description={text.localApiReadHint} checked={clipboardSettings.localApiRead === true} onChange={(localApiRead) => onChange({ localApiRead })} />
      <SettingsNumberRow title={text.maxItems} value={clipboardSettings.maxItems} min={CLIPBOARD_MIN_ITEMS} max={CLIPBOARD_MAX_ITEMS} onChange={(maxItems) => onChange({ maxItems })} />
      <SettingsRow
        title={text.retention}
        description={text.retentionHint}
        control={
          <SettingsSelect
            value={String(clipboardSettings.retentionDays)}
            ariaLabel={text.retention}
            options={CLIPBOARD_RETENTION_DAYS.map((days) => ({ value: String(days), label: text.retentionOption(days) }))}
            onChange={(value) => onChange({ retentionDays: Number(value) })}
          />
        }
      />
    </SettingsGroup>
  );
}
