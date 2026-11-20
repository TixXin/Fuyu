import { Bot } from "lucide-react";
import { WidgetEmpty, WidgetFrame } from "../../../components/island-widget/WidgetFrame";
import { useTranslation } from "../../../i18n";
import { defineSlot, type IslandWidgetMeta, type IslandWidgetProps } from "../../plugin-kernel/slots";
import type { AgentSessionSummary } from "../api";
import { sessionName } from "../session";
import { agentShell } from "./islandState";
import { AGENT_SESSIONS_WIDGET } from "./widgets.ts";

const ROW_PX = 24;
const HEAD_PX = 22;

const TONES: Record<AgentSessionSummary["phase"], string> = {
  running: "accent",
  waiting: "warning",
  failed: "danger",
  completed: "done",
  stale: "muted",
};

const widgetSlot = defineSlot<IslandWidgetProps, IslandWidgetMeta>("island.widget/v1");

function AgentSessionsWidget({ height }: IslandWidgetProps) {
  const t = useTranslation().islandWidgets;
  const { listed } = agentShell.use();
  const open = listed.filter((session) => !session.closed);
  const shown = open.slice(0, Math.max(1, Math.floor((height - HEAD_PX) / ROW_PX)));
  return (
    <WidgetFrame icon={Bot} title={t.widgets.agentSessions} aside={open.length > 0 ? t.content.sessionCount(open.length) : null}>
      {shown.length === 0 ? (
        <WidgetEmpty>{t.content.noSessions}</WidgetEmpty>
      ) : (
        <ul className="island-widget__list">
          {shown.map((session) => {
            const name = sessionName(session);
            return (
              <li key={`${session.provider}-${session.sessionId}`} className="island-widget__row">
                <span className="island-widget__dot" data-tone={TONES[session.phase]} aria-hidden="true" />
                <span>{name.title || name.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetFrame>
  );
}

widgetSlot.add({ ...AGENT_SESSIONS_WIDGET, component: AgentSessionsWidget }, AGENT_SESSIONS_WIDGET.owner);
