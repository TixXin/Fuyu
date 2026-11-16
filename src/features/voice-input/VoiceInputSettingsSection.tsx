import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { isNativeError } from "../../i18n/nativeError";
import { useErrorText, useTranslation } from "../../i18n";
import type { VoiceInputSettings } from "./settings";
import { downloadPercent, formatMegabytes } from "./settings";
import { useVoiceModel } from "./useVoiceModel";
import { VoiceShortcutRow } from "./VoiceShortcutRow";
import "../../components/controls/ShortcutControl.css";
import "./VoiceInputSettingsSection.css";

function ModelRow() {
  const t = useTranslation().voiceInput.settings;
  const errorText = useErrorText();
  const { status, progress, error, download, cancel, remove } = useVoiceModel();
  const busy = Boolean(status?.downloading || progress);
  const state = progress?.stage === "unpack"
    ? t.unpacking
    : progress
      ? t.downloading(downloadPercent(progress.downloaded, progress.total), progress.source)
      : status?.installed
        ? t.modelReady(formatMegabytes(status.sizeBytes))
        : status && !status.supported
        ? t.unsupported
        : t.modelMissing(formatMegabytes(status?.downloadBytes ?? 0));
  const shownError = error && !(isNativeError(error) && error.code === "voiceInput.downloadCancelled") ? errorText(error) : null;
  const control = busy
    ? progress?.stage !== "unpack" && <SettingsLinkButton onClick={cancel}>{t.cancelDownload}</SettingsLinkButton>
    : status?.installed
      ? <SettingsLinkButton tone="danger" onClick={remove}>{t.deleteModel}</SettingsLinkButton>
      : status?.supported && <SettingsLinkButton onClick={download}>{t.download}</SettingsLinkButton>;
  return (
    <SettingsRow title={t.modelName} description={state} control={control || undefined}>
      {busy && progress?.stage === "download" && (
        <progress className="voice-model-progress" max={100} value={downloadPercent(progress.downloaded, progress.total)} />
      )}
      {shownError && <p className="shortcut-control__error" role="alert">{shownError}</p>}
    </SettingsRow>
  );
}

export function VoiceInputSettingsSection({ settings, onSettingsChange, takenBy }: {
  settings: VoiceInputSettings;
  onSettingsChange: (settings: VoiceInputSettings) => void;
  takenBy: (shortcut: string) => string | null;
}) {
  const t = useTranslation().voiceInput.settings;
  return (
    <>
      <SettingsGroup title={t.title} footer={`${t.shortcutHint} ${t.languages}`}>
        <VoiceShortcutRow shortcut={settings.shortcut} takenBy={takenBy} onChange={(shortcut) => onSettingsChange({ ...settings, shortcut })} />
      </SettingsGroup>
      <SettingsGroup title={t.modelTitle} footer={t.privacy}>
        <ModelRow />
      </SettingsGroup>
    </>
  );
}
