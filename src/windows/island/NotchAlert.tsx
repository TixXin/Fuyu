import { Gauge, RotateCcw, Sun, Volume1, Volume2, VolumeX } from "lucide-react";
import type { QuotaAlert } from "../../features/agent-status/quotaAlerts";
import type { DeviceAlert } from "../../features/device-events/api";
import { deviceAlertLook } from "../../features/device-events/deviceAlertLook";
import type { LevelChange } from "../../features/system-levels/api";
import { LevelPopup } from "../../features/system-levels/LevelPopup";
import { useTranslation } from "../../i18n";

export type NotchAlertSources = {
  deviceAlert: DeviceAlert | null;
  quotaAlert: QuotaAlert | null;
  levelPopup: LevelChange | null;
};

export function hasNotchAlert({ deviceAlert, quotaAlert, levelPopup }: NotchAlertSources) {
  return Boolean(deviceAlert || quotaAlert || levelPopup);
}

function levelMuted(change: LevelChange) {
  return change.kind === "volume" && (change.muted || Math.round(change.level * 100) === 0);
}

export function NotchAlertLeading({ deviceAlert, quotaAlert, levelPopup }: NotchAlertSources) {
  const t = useTranslation();
  if (deviceAlert) {
    const { Icon, tone } = deviceAlertLook(deviceAlert, t.island.deviceAlert);
    return (
      <span className={`notch-alert__icon device-alert device-alert--${tone}`} aria-hidden="true">
        <Icon className="device-alert__icon" size={16} strokeWidth={2.2} />
      </span>
    );
  }
  if (quotaAlert) {
    const Icon = quotaAlert.kind === "low" ? Gauge : RotateCcw;
    return (
      <span className={`notch-alert__icon agent-quota-alert agent-quota-alert--${quotaAlert.kind}`} aria-hidden="true">
        <Icon className="agent-quota-alert__icon" size={16} strokeWidth={2.2} />
      </span>
    );
  }
  if (!levelPopup) return null;
  const percent = Math.round(levelPopup.level * 100);
  const Icon = levelPopup.kind === "brightness" ? Sun : levelMuted(levelPopup) ? VolumeX : percent < 50 ? Volume1 : Volume2;
  return (
    <span className={`notch-alert__icon level-popup level-popup--${levelPopup.kind}`} aria-hidden="true">
      <Icon className="level-popup__icon" size={16} strokeWidth={2.2} />
    </span>
  );
}

export function NotchAlertTrailing({ deviceAlert, quotaAlert, levelPopup }: NotchAlertSources) {
  const t = useTranslation();
  if (deviceAlert) {
    const { tone, battery, label } = deviceAlertLook(deviceAlert, t.island.deviceAlert);
    return (
      <span className={`notch-alert__value device-alert device-alert--${tone}`} role="status" aria-label={label}>
        <span className={battery === null ? "device-alert__text" : "device-alert__battery"} aria-hidden="true">
          {battery === null ? deviceAlert.kind === "powerConnected" || deviceAlert.kind === "powerDisconnected" ? "" : deviceAlert.name : `${battery}%`}
        </span>
      </span>
    );
  }
  if (quotaAlert) {
    const text = t.agent.quota;
    const agent = quotaAlert.agent === "claude" ? "Claude" : "Codex";
    const span = quotaAlert.window === "fiveHour" ? text.fiveHour : text.sevenDay;
    const low = quotaAlert.kind === "low";
    const label = low ? text.low(agent, span, Math.round(quotaAlert.used)) : text.reset(agent, span);
    return (
      <span className={`notch-alert__value agent-quota-alert agent-quota-alert--${quotaAlert.kind}`} role="status" aria-label={label}>
        <span className="agent-quota-alert__text" aria-hidden="true">{low ? `${Math.round(quotaAlert.used)}%` : span}</span>
      </span>
    );
  }
  return levelPopup ? <span className="notch-alert__value notch-alert__level"><LevelPopup change={levelPopup} /></span> : null;
}
