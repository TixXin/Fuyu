import { useEffect, useState, useSyncExternalStore } from "react";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useLocale, useTranslation } from "../../i18n";
import { CHECK_INTERVAL_HOURS } from "./storage";
import { getUpdateState, setAutoCheck, setCheckInterval, setReminderMode, subscribeToUpdate } from "./updaterController";
import { UpdatePanel } from "./UpdatePanel";

export function UpdateSettingsSection() {
  const t = useTranslation();
  const { locale } = useLocale();
  const text = t.settings.project.update;
  const state = useSyncExternalStore(subscribeToUpdate, getUpdateState);
  const { stage, autoCheck, lastCheckedAt, nextCheckAt, checkIntervalHours, reminderMode } = state;
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", sync); };
  }, []);
  const time = (at: number) => new Date(at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
  const lastChecked = lastCheckedAt === null ? text.neverChecked : text.lastChecked(time(lastCheckedAt));
  let schedule = "";
  if (autoCheck) {
    if (["downloading", "installing", "done"].includes(stage)) schedule = text.schedulePaused;
    else if (stage === "checking") schedule = text.checking;
    else if (!online) schedule = text.offline;
    else if (nextCheckAt !== null) schedule = nextCheckAt <= Date.now() ? text.pendingCheck
      : state.checkFailures > 0 ? text.retryCheck(time(nextCheckAt)) : text.nextCheck(time(nextCheckAt));
  }

  return (
    <SettingsGroup title={t.settings.project.versionTitle} footer={stage === "disabled" ? undefined : (
      <span className="update-schedule" aria-live="polite">
        <span>{lastChecked}</span>
        {schedule && <span>{schedule}</span>}
        {autoCheck && reminderMode === "notification" && state.notificationUnavailable && <span>{text.notificationUnavailable}</span>}
      </span>
    )}>
      <div className="about-update"><UpdatePanel /></div>
      {stage !== "disabled" && <>
        <SettingsToggleRow title={text.autoCheck} description={text.autoCheckHint} checked={autoCheck} onChange={setAutoCheck} />
        {autoCheck && <>
          <SettingsRow indent title={text.checkFrequency} description={text.checkFrequencyHint} control={
            <SettingsSelect value={String(checkIntervalHours)} options={CHECK_INTERVAL_HOURS.map((hours) => ({ value: String(hours), label: text.frequencyHours(hours) }))}
              ariaLabel={text.checkFrequency} onChange={(value) => setCheckInterval(Number(value))} />
          } />
          <SettingsRow indent title={text.reminderMode} description={text.reminderHint} control={
            <SettingsSelect value={reminderMode} options={[
              { value: "badge", label: text.reminderBadge }, { value: "notification", label: text.reminderNotification },
            ]} ariaLabel={text.reminderMode} onChange={setReminderMode} />
          } />
        </>}
      </>}
    </SettingsGroup>
  );
}
