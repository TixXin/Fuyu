import { Activity, BatteryCharging, BatteryFull, Cpu } from "lucide-react";
import { WidgetEmpty, WidgetFrame } from "../../components/island-widget/WidgetFrame";
import { useTranslation } from "../../i18n";
import { useSystemStats } from "./statsStore";

const RING_R = 17;
const RING_LENGTH = 2 * Math.PI * RING_R;

function rateText(bytesPerSecond: number): string {
  if (bytesPerSecond < 1024) return `${Math.round(bytesPerSecond)} B/s`;
  if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(bytesPerSecond < 10 * 1024 ? 1 : 0)} KB/s`;
  return `${(bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s`;
}

function Ring({ share, label, kind }: { share: number | null; label: string; kind: "cpu" | "memory" }) {
  return (
    <div className="sys-ring" data-kind={kind}>
      <div className="sys-ring__circle">
        <svg viewBox="0 0 42 42" aria-hidden="true">
          <circle className="sys-ring__track" cx="21" cy="21" r={RING_R} />
          <circle className="sys-ring__value" cx="21" cy="21" r={RING_R} strokeDasharray={`${(share ?? 0) * RING_LENGTH} ${RING_LENGTH}`} />
        </svg>
        <span>{share === null ? "–" : Math.round(share * 100)}</span>
      </div>
      <span className="sys-ring__label">{label}</span>
    </div>
  );
}

export function SystemStatusWidget() {
  const t = useTranslation().islandWidgets;
  const { stats } = useSystemStats();
  const memory = stats?.memory ? stats.memory.used / stats.memory.total : null;
  return (
    <WidgetFrame icon={Cpu} title={t.widgets.systemStatus} className="sys-status">
      <div className="sys-status__rings">
        <Ring share={stats?.cpu ?? null} label={t.content.cpu} kind="cpu" />
        <Ring share={memory} label={t.content.memory} kind="memory" />
      </div>
    </WidgetFrame>
  );
}

export function BatteryWidget() {
  const t = useTranslation().islandWidgets;
  const { stats } = useSystemStats();
  const battery = stats?.battery ?? null;
  const level = battery?.level ?? null;
  const state = !battery ? null : battery.pluggedIn ? (level !== null && level >= 100 ? t.content.charged : t.content.charging) : t.content.onBattery;
  return (
    <WidgetFrame icon={battery?.pluggedIn ? BatteryCharging : BatteryFull} title={t.widgets.battery} className="sys-battery">
      {battery && level !== null ? (
        <>
          <div className="sys-fill" />
          <span className="island-widget__big sys-battery__level" data-low={level <= 20 && !battery.pluggedIn ? "true" : undefined}>
            {level}
            <small>%</small>
          </span>
          <span className="sys-battery__bar" aria-hidden="true">
            <b style={{ width: `${level}%` }} data-low={level <= 20 && !battery.pluggedIn ? "true" : undefined} />
          </span>
          <span className="island-widget__sub">{state}</span>
        </>
      ) : stats && !battery ? (
        <>
          <WidgetEmpty>{t.content.noBattery}</WidgetEmpty>
          <span className="island-widget__sub sys-battery__hint">{t.content.noBatteryHint}</span>
        </>
      ) : (
        <span className="island-widget__big sys-battery__level">–</span>
      )}
    </WidgetFrame>
  );
}

export function NetworkWidget() {
  const t = useTranslation().islandWidgets;
  const { stats, downs } = useSystemStats();
  const network = stats?.network ?? null;
  const top = Math.max(1024, ...downs);
  const points = downs.map((value, at) => `${(at / Math.max(1, downs.length - 1)) * 96},${24 - (value / top) * 22}`).join(" ");
  return (
    <WidgetFrame icon={Activity} title={t.widgets.network} className="sys-network">
      <div className="sys-network__rows">
        <span data-way="down">↓ <b>{network ? rateText(network.down) : "–"}</b></span>
        <span data-way="up">↑ <b>{network ? rateText(network.up) : "–"}</b></span>
      </div>
      <svg className="sys-network__spark" viewBox="0 0 96 26" preserveAspectRatio="none" aria-hidden="true">
        {downs.length > 1 ? <polyline points={points} /> : null}
      </svg>
    </WidgetFrame>
  );
}
