import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { BatteryCharging, BatteryFull } from "lucide-react";
import { WidgetEmpty, WidgetFrame } from "../../components/island-widget/WidgetFrame";
import { useTranslation } from "../../i18n";
import type { IslandWidgetProps } from "../plugin-kernel/slots";
import {
  formatWattHours,
  formatWatts,
  type BatteryPoint,
} from "./batteryPrefs";
import { useSystemStats } from "./statsStore";
import { useBatteryPrefs } from "./useBatteryPrefs";
import "./batteryDetails.css";

const CURVE_W = 180;
const CURVE_H = 38;
const CURVE_PAD = 4;

function formatClock(at: number): string {
  const date = new Date(at);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function BatteryCurve({ points }: { points: readonly BatteryPoint[] }) {
  const t = useTranslation().islandWidgets.system.battery;
  const [active, setActive] = useState<number | null>(null);
  if (points.length < 2) return null;

  const span = Math.max(1, points.length - 1);
  const coords = points.map((point, index) => ({
    x: CURVE_PAD + (index / span) * (CURVE_W - CURVE_PAD * 2),
    y: CURVE_H - CURVE_PAD - (point.level / 100) * (CURVE_H - CURVE_PAD * 2),
    point,
  }));
  const line = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const focusedIndex = active !== null ? Math.min(active, points.length - 1) : null;
  const focused = focusedIndex !== null ? coords[focusedIndex] : null;

  const pickAt = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setActive(Math.round(ratio * span));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setActive((current) => Math.max(0, (current ?? points.length - 1) - 1));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setActive((current) => Math.min(points.length - 1, (current ?? -1) + 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(points.length - 1);
    } else if (event.key === "Escape") {
      setActive(null);
    }
  };

  return (
    <div
      className="sys-battery__curve-wrap"
      role="slider"
      tabIndex={0}
      aria-label={t.curveLabel}
      aria-valuemin={0}
      aria-valuemax={points.length - 1}
      aria-valuenow={focusedIndex ?? points.length - 1}
      aria-valuetext={focused ? t.curvePoint(formatClock(focused.point.at), focused.point.level, focused.point.pluggedIn) : undefined}
      onKeyDown={onKeyDown}
      onBlur={() => setActive(null)}
    >
      <svg
        className="sys-battery__curve"
        viewBox={`0 0 ${CURVE_W} ${CURVE_H}`}
        preserveAspectRatio="none"
        onPointerMove={pickAt}
        onPointerLeave={() => setActive(null)}
      >
        <polyline className="sys-battery__curve-line" points={line} />
        {focused && (
          <>
            <line className="sys-battery__curve-guide" x1={focused.x} y1={0} x2={focused.x} y2={CURVE_H} />
            <circle className="sys-battery__curve-dot" cx={focused.x} cy={focused.y} r="3" />
          </>
        )}
      </svg>
      <div className="sys-battery__curve-meta">
        {focused ? (
          <span>{t.curvePoint(formatClock(focused.point.at), focused.point.level, focused.point.pluggedIn)}</span>
        ) : (
          <>
            <span>{formatClock(points[0].at)}</span>
            <span>{t.curveHint}</span>
            <span>{formatClock(points[points.length - 1].at)}</span>
          </>
        )}
      </div>
    </div>
  );
}

export function BatteryWidget({ size }: IslandWidgetProps) {
  const i18n = useTranslation();
  const t = i18n.islandWidgets;
  const bt = t.system.battery;
  const { stats, batteryHistory } = useSystemStats();
  const [prefs] = useBatteryPrefs();
  const battery = stats?.battery ?? null;
  const level = battery?.level ?? null;
  const detailed = size === "m";

  const state = !battery
    ? null
    : battery.pluggedIn
      ? (level !== null && level >= 100 && !battery.charging ? t.content.charged : t.content.charging)
      : t.content.onBattery;

  const eta = !battery
    ? null
    : battery.pluggedIn
      ? (battery.timeToFullMinutes ? bt.fullIn(bt.duration(battery.timeToFullMinutes)) : null)
      : (battery.remainingMinutes ? bt.remaining(bt.duration(battery.remainingMinutes)) : null);

  const hasCapacity = Boolean(battery && (battery.currentMwh || battery.fullChargeMwh || battery.designMwh || battery.healthPercent));
  const capacityParts: string[] = [];
  if (battery?.currentMwh && battery?.fullChargeMwh) {
    capacityParts.push(`${formatWattHours(battery.currentMwh)} / ${formatWattHours(battery.fullChargeMwh)}`);
  } else if (battery?.fullChargeMwh && battery?.designMwh) {
    capacityParts.push(`${formatWattHours(battery.fullChargeMwh)} / ${formatWattHours(battery.designMwh)}`);
  }
  if (battery?.healthPercent) capacityParts.push(bt.health(battery.healthPercent));

  const powerText = battery?.rateMw && Math.abs(battery.rateMw) >= 100 ? formatWatts(battery.rateMw) : null;

  return (
    <WidgetFrame icon={battery?.pluggedIn ? BatteryCharging : BatteryFull} title={t.widgets.battery} className={`sys-battery${detailed ? " sys-battery--detailed" : ""}`}>
      {battery && level !== null ? (
        detailed ? (
          <div className="sys-battery__detail">
            <div className="sys-battery__head">
              <span className="island-widget__big sys-battery__level" data-low={level <= 20 && !battery.pluggedIn ? "true" : undefined}>
                {level}
                <small>%</small>
              </span>
              <div className="sys-battery__summary">
                <span className="sys-battery__eta">{eta ?? state}</span>
                {powerText && <span className="sys-battery__power">{powerText}</span>}
              </div>
            </div>
            <span className="sys-battery__bar" aria-hidden="true">
              <b style={{ width: `${level}%` }} data-low={level <= 20 && !battery.pluggedIn ? "true" : undefined} />
            </span>
            {hasCapacity && capacityParts.length > 0 && (
              <div className="sys-battery__metrics" title={battery.designMwh ? bt.designCapacity(formatWattHours(battery.designMwh)) : undefined}>
                {capacityParts.join(" · ")}
              </div>
            )}
            {prefs.showCurve && <BatteryCurve points={batteryHistory} />}
          </div>
        ) : (
          <>
            <div className="sys-fill" />
            <span className="island-widget__big sys-battery__level" data-low={level <= 20 && !battery.pluggedIn ? "true" : undefined}>
              {level}
              <small>%</small>
            </span>
            <span className="sys-battery__bar" aria-hidden="true">
              <b style={{ width: `${level}%` }} data-low={level <= 20 && !battery.pluggedIn ? "true" : undefined} />
            </span>
            <span className="island-widget__sub">{eta ?? state}</span>
          </>
        )
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
