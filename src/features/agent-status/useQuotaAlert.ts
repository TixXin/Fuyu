import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { emptyQuotaState, takeQuotaAlerts, type QuotaAlert } from "./quotaAlerts";
import { playAgentSound } from "./sounds/player";
import { useAgentSoundSettings } from "./sounds/useAgentSoundSettings";
import type { AgentUsages } from "./usage";

export const QUOTA_ALERT_MS = 4000;

export function useQuotaAlert(usages: AgentUsages, percent: number, { quiet, canPopUp }: { quiet: boolean; canPopUp: boolean }): QuotaAlert | null {
  const [alert, setAlert] = useState<QuotaAlert | null>(null);
  const [sounds] = useAgentSoundSettings();
  const stateRef = useRef(emptyQuotaState());
  const latest = useRef({ percent, quiet, canPopUp, sounds });
  useLayoutEffect(() => {
    latest.current = { percent, quiet, canPopUp, sounds };
  });

  useEffect(() => {
    const { percent: level, quiet: silent, canPopUp: canShow, sounds: soundSettings } = latest.current;
    const alerts = takeQuotaAlerts(stateRef.current, usages, level, usages.readAt);
    const newest = alerts.find((item) => item.kind === "low") ?? alerts[0];
    if (!newest) return;
    if (!silent) playAgentSound(newest.kind === "low" ? "quotaLow" : "quotaReset", soundSettings);
    if (canShow) setAlert(newest);
  }, [usages]);

  useEffect(() => {
    if (!canPopUp) setAlert(null);
  }, [canPopUp]);

  useEffect(() => {
    if (!alert) return;
    const timer = window.setTimeout(() => setAlert(null), QUOTA_ALERT_MS);
    return () => window.clearTimeout(timer);
  }, [alert]);

  return alert;
}
