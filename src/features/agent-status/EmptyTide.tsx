import { useState } from "react";
import { useTranslation } from "../../i18n";
import { AgentProviderIcon } from "./AgentProviderIcon";
import { TIDE_GROUPS, TIDE_SLOTS, tideArea, tideMinutes, tideSlot, type TideGroup } from "./tide";
import { useTide } from "./useAgentTide";
import "./EmptyTide.css";

const WIDTH = 640;
const HEIGHT = 84;
const BASE = 66;
const AMPLITUDE = 54;
const TICKS = [0, 6, 12, 18, 24];
const ICON: Record<TideGroup, string> = { claude: "claudeCode", codex: "codex", other: "other" };

export function EmptyTide() {
  const text = useTranslation().agent.empty;
  const tide = useTide(true);
  const [now] = useState(() => Date.now());
  if (!tide) return null;
  const nowX = ((tideSlot(now) + 0.5) / TIDE_SLOTS) * WIDTH;
  const groups = TIDE_GROUPS.filter((group) => tide.sessions[group].length > 0);
  const total = groups.reduce((sum, group) => sum + tide.sessions[group].length, 0);

  return (
    <div className="agent-empty agent-empty--tide">
      <strong>{text.tideTitle}</strong>
      <span>{tide.lastActiveAt === null ? text.tideQuiet : text.tideLast(text.ago(Math.floor((now - tide.lastActiveAt) / 60_000)))}</span>
      <svg className="agent-tide" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={text.tideLabel}>
        <path className="agent-tide__base" d={`M0 ${BASE}H${WIDTH}`} />
        <path className="agent-tide__past" d={`M0 ${BASE}H${nowX}`} />
        {[...TIDE_GROUPS].reverse().map((group) => {
          const area = tideArea(tide.slots[group], WIDTH, BASE, AMPLITUDE);
          return area && <path key={group} className={`agent-tide__area agent-tide__area--${group}`} d={area} />;
        })}
        <circle className="agent-tide__now" cx={nowX} cy={BASE} r={3} />
        {TICKS.map((hour) => (
          <text key={hour} className="agent-tide__tick" x={Math.min(WIDTH - 8, Math.max(8, (hour / 24) * WIDTH))} y={HEIGHT - 2} textAnchor="middle">{hour}</text>
        ))}
      </svg>
      {groups.length > 0 && (
        <div className="agent-tide__legend">
          {groups.map((group) => (
            <span key={group} className="agent-tide__group">
              <i className={`agent-tide__swatch agent-tide__area--${group}`} aria-hidden="true" />
              {group !== "other" && <AgentProviderIcon provider={ICON[group]} size={12} />}
              {text.tideGroup(tide.sessions[group].length, text.duration(tideMinutes(tide, group)))}
            </span>
          ))}
          <span>{text.tideTotal(total)}</span>
        </div>
      )}
    </div>
  );
}
