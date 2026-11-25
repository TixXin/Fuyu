import { useEffect, useState } from "react";
import { RotateCw, Trash2 } from "lucide-react";
import { SettingsFootnote } from "../../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
import { useErrorText, useTranslation } from "../../../i18n";
import { restartIsland } from "../../../lib/settings-backup/api";
import {
  clearWebviewGpuCacheAndRestart,
  readWebviewGpuState,
  setWebviewGpuMode,
  type WebviewGpuState,
} from "../api";
import "./SettingsBackupSection.css";

export function GraphicsCompatibilitySection() {
  const text = useTranslation().settings.generalLogs.graphics;
  const errorText = useErrorText();
  const [state, setState] = useState<WebviewGpuState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readWebviewGpuState()
      .then((current) => {
        if (!cancelled && current) setState(current);
      })
      .catch((caught: unknown) => console.error("Failed to read graphics compatibility state", caught));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state?.supported) return null;

  const warpEnabled = state.configuredMode === "warp";
  const description = state.autoEnabled && warpEnabled
    ? text.autoNotice(state.autoReason)
    : text.compatHint;

  const toggleWarp = (enabled: boolean) => {
    setBusy(true);
    setError(null);
    void setWebviewGpuMode(enabled ? "warp" : "auto")
      .then((next) => setState(next))
      .catch((caught: unknown) => setError(errorText(caught)))
      .finally(() => setBusy(false));
  };

  const clearCache = () => {
    setBusy(true);
    setError(null);
    void clearWebviewGpuCacheAndRestart()
      .catch((caught: unknown) => {
        setError(errorText(caught));
        setBusy(false);
      });
  };

  return (
    <SettingsGroup
      footer={
        <>
          <SettingsFootnote text={text.footnote} />
          {state.restartRequired ? (
            <p className="settings-backup__status" role="status">
              <span>{text.restartNeeded}</span>
              <button className="settings-backup__link" type="button" onClick={() => void restartIsland()}>
                <RotateCw size={12} strokeWidth={2.2} aria-hidden="true" />
                {text.restartNow}
              </button>
            </p>
          ) : null}
          {error ? (
            <p className="settings-backup__status settings-backup__status--error" role="alert">
              {error}
            </p>
          ) : null}
        </>
      }
    >
      <SettingsToggleRow
        title={text.compatTitle}
        description={description}
        checked={warpEnabled}
        disabled={busy}
        onChange={toggleWarp}
      />
      <SettingsRow
        title={text.clearCacheTitle}
        description={text.clearCacheHint}
        control={
          <SettingsLinkButton disabled={busy} onClick={clearCache}>
            <Trash2 size={13} strokeWidth={2.2} aria-hidden="true" />
            {text.clearCacheAction}
          </SettingsLinkButton>
        }
      />
    </SettingsGroup>
  );
}
