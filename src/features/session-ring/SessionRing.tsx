import { useMemo, type CSSProperties } from "react";
import { IslandHoverCard } from "../../components/IslandHoverCard";
import { MiniRing } from "../../components/MiniRing";
import { useTranslation } from "../../i18n";
import type { AgentSessionSummary } from "../agent-status/api";
import {
  SESSION_RING_STATES,
  sessionGridCells,
  sessionRingCardLines,
  sessionRingSegments,
  sessionRingSummary,
  sessionSignal,
  type SessionRingCounts,
} from "./ringCounts.ts";
import "./SessionRing.css";

export const SESSION_RING_SIZE = 24;

export const SESSION_RING_STYLES = ["grid", "ring", "bar", "signal"] as const;
export type SessionRingStyle = (typeof SESSION_RING_STYLES)[number];

const STATE_COLORS: Record<string, string> = Object.fromEntries(SESSION_RING_STATES.map(({ key, color }) => [key, color]));
const colorOf = (state: string | undefined) => (state && STATE_COLORS[state] ? ({ "--cell-color": STATE_COLORS[state] } as CSSProperties) : undefined);

type SessionRingProps = {
  sessions: readonly AgentSessionSummary[];
  unseen: ReadonlySet<string>;
  counts: SessionRingCounts;
  style: SessionRingStyle;
  showCount: boolean;
  paused: boolean;
  onOpen: () => void;
};

function SessionGrid({ counts }: { counts: SessionRingCounts }) {
  const cells = sessionGridCells(counts);
  const side = cells.length <= 4 ? 2 : 3;
  return (
    <span className={`session-grid session-grid--${side}`} aria-hidden="true">
      {Array.from({ length: side * side }, (_, index) => (
        <span key={index} className="session-grid__cell" data-state={cells[index]} style={colorOf(cells[index])} />
      ))}
    </span>
  );
}

function SessionBar({ counts, showCount }: { counts: SessionRingCounts; showCount: boolean }) {
  return (
    <span className="session-bar" aria-hidden="true">
      {showCount && <span className="session-bar__count">{counts.total}</span>}
      <span className="session-bar__track">
        {SESSION_RING_STATES.filter(({ key }) => counts[key] > 0).map(({ key }) => (
          <span key={key} className="session-bar__part" data-state={key} style={{ ...colorOf(key), flexGrow: counts[key] }} />
        ))}
      </span>
    </span>
  );
}

function SessionSignal({ counts }: { counts: SessionRingCounts }) {
  const { columns, slots, bar } = sessionSignal(counts);
  return (
    <span className="session-signal" style={{ "--signal-bar": bar } as CSSProperties} aria-hidden="true">
      {columns.map(({ key, bars }) => (
        <span key={key} className="session-signal__column" data-column={key}>
          {Array.from({ length: slots }, (_, index) => (
            <span key={index} className="session-signal__bar" data-state={bars[index]} style={colorOf(bars[index])} />
          ))}
        </span>
      ))}
    </span>
  );
}

export function SessionRing({ sessions, unseen, counts, style, showCount, paused, onOpen }: SessionRingProps) {
  const t = useTranslation();
  const summary = sessionRingSummary(counts, t.sessionRing);
  const lines = useMemo(
    () => sessionRingCardLines(sessions, unseen, t.sessionRing).map((text) => ({ text })),
    [sessions, unseen, t.sessionRing],
  );
  return (
    <IslandHoverCard lines={lines}>
      <button
        className={`session-ring session-ring--button${paused ? " session-ring--paused" : ""}`}
        type="button"
        aria-label={t.sessionRing.openAgents(summary)}
        onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}
      >
        {style === "ring" ? (
          <MiniRing
            className={counts.total >= 10 ? "session-ring__ring--long" : undefined}
            segments={sessionRingSegments(counts)}
            size={SESSION_RING_SIZE}
            label={showCount ? String(counts.total) : undefined}
            ariaLabel={summary}
          />
        ) : style === "bar" ? (
          <SessionBar counts={counts} showCount={showCount} />
        ) : style === "signal" ? (
          <SessionSignal counts={counts} />
        ) : (
          <SessionGrid counts={counts} />
        )}
      </button>
    </IslandHoverCard>
  );
}
