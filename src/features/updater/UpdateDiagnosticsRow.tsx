import { useState } from "react";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { useLocale, useTranslation } from "../../i18n";
import { getUpdateDiagnostics } from "./api";
import { getUpdateState } from "./updaterController";
import "./UpdateDiagnosticsRow.css";

/** Copies exactly the allowlisted text the user previewed, never raw errors or paths. */
export function UpdateDiagnosticsRow() {
  const t = useTranslation().settings.project;
  const text = t.diagnostics;
  const { locale } = useLocale();
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<"copied" | "copyFailed" | "loadFailed" | null>(null);
  async function preview() {
    setLoading(true);
    setFeedback(null);
    try {
      const system = await getUpdateDiagnostics();
      const state = getUpdateState();
      setReport([
        `${text.version}: Fuyu ${state.version}`,
        `${text.system}: ${system.osVersion}`,
        `${text.architecture}: ${system.architecture}`,
        `${text.channel}: ${state.channel === "beta" ? t.update.channelBeta : t.update.channelStable}`,
        `${text.autoCheck}: ${state.autoCheck ? text.enabled : text.disabled}`,
        `${text.interval}: ${t.update.frequencyHours(state.checkIntervalHours)}`,
        `${text.lastCheck}: ${state.lastCheckedAt === null ? t.update.neverChecked : new Date(state.lastCheckedAt).toLocaleString(locale)}`,
        `${text.stage}: ${state.stage}`,
      ].join("\n"));
    } catch { setFeedback("loadFailed"); }
    finally { setLoading(false); }
  }
  async function copy() {
    if (report === null) return;
    try { await navigator.clipboard.writeText(report); setFeedback("copied"); }
    catch { setFeedback("copyFailed"); }
  }
  return (
    <SettingsRow title={text.title} description={text.hint} control={report === null ? (
      <SettingsLinkButton disabled={loading} onClick={() => void preview()}>{text.preview}</SettingsLinkButton>
    ) : (
      <>
        <SettingsLinkButton onClick={() => void copy()}>{text.copy}</SettingsLinkButton>
        <SettingsLinkButton onClick={() => { setReport(null); setFeedback(null); }}>{text.close}</SettingsLinkButton>
      </>
    )}>
      {report !== null && <pre className="update-diagnostics" aria-label={text.title}>{report}</pre>}
      {feedback && <span className="update-diagnostics__feedback" role="status">{text[feedback]}</span>}
    </SettingsRow>
  );
}
