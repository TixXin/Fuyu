import { MiniRing } from "../../components/MiniRing";
import type { PluginStatusEntry, PluginStatusSlice } from "./api";
import "./PluginStatusChip.css";

const RING_SIZE = 16;

function Pie({ slices }: { slices: readonly PluginStatusSlice[] }) {
  const center = RING_SIZE / 2;
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const point = (turn: number) => `${center + center * Math.sin(2 * Math.PI * turn)} ${center - center * Math.cos(2 * Math.PI * turn)}`;
  let start = 0;
  return (
    <svg className="plugin-status-chip__pie" width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} aria-hidden="true">
      {total <= 0 ? (
        <circle className="plugin-status-chip__pie-empty" cx={center} cy={center} r={center - 0.75} />
      ) : (
        slices.map((slice, index) => {
          const share = slice.value / total;
          const from = start;
          start += share;
          const className = `plugin-status-chip__slice plugin-status-chip__slice--${slice.tone}`;
          if (share >= 1) return <circle key={index} className={className} cx={center} cy={center} r={center} />;
          const d = share > 0 ? `M ${center} ${center} L ${point(from)} A ${center} ${center} 0 ${share > 0.5 ? 1 : 0} 1 ${point(start)} Z` : "";
          return <path key={index} className={className} d={d} />;
        })
      )}
    </svg>
  );
}

export function PluginStatusChip({ status, onOpen }: { status: PluginStatusEntry; onOpen: (() => void) | null }) {
  const title = status.tooltip ? `${status.text} · ${status.tooltip}` : status.text;
  const batteries = status.batteries ?? [];
  const pie = batteries.length > 0 ? [] : (status.pie ?? []);
  const cells = batteries.length > 0 || pie.length > 0 ? [] : (status.cells ?? []);
  const classes = ["plugin-status-chip", `plugin-status-chip--${status.tone}`];
  if (cells.length > 0) classes.push("plugin-status-chip--cells");
  if (batteries.length > 0 || pie.length > 0) classes.push("plugin-status-chip--batteries");
  if (status.ring != null) classes.push("plugin-status-chip--ring");
  return (
    <button
      className={classes.join(" ")}
      type="button"
      aria-label={title}
      title={status.tooltip ?? undefined}
      disabled={!onOpen}
      onClick={(event) => {
        event.stopPropagation();
        onOpen?.();
      }}
    >
      {status.ring != null && (
        <MiniRing
          className="plugin-status-chip__ring"
          rings={[{ value: status.ring, color: "currentColor" }]}
          size={RING_SIZE}
          strokeWidth={2.5}
          ariaLabel=""
        />
      )}
      {batteries.length > 0 ? (
        <span className="plugin-status-chip__batteries" aria-hidden="true">
          {batteries.map((battery, index) => (
            <span key={index} className={`plugin-status-chip__battery plugin-status-chip__battery--${battery.tone}`}>
              <span className="plugin-status-chip__charge" style={{ height: `${Math.round(battery.level * 100)}%` }} />
            </span>
          ))}
        </span>
      ) : pie.length > 0 ? (
        <Pie slices={pie} />
      ) : cells.length > 0 ? (
        cells.map((cell, index) => (
          <span key={index} className={`plugin-status-chip__cell plugin-status-chip__cell--${cell.tone}`} aria-hidden="true">
            <span className="plugin-status-chip__label">{cell.label}</span>
            <span className="plugin-status-chip__value">{cell.value}</span>
          </span>
        ))
      ) : (
        <span className="plugin-status-chip__text">{status.text}</span>
      )}
    </button>
  );
}
