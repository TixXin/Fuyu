import { Bot } from "lucide-react";
import { clickOnly } from "../../../components/island-widget/clickOnly";
import { WidgetEmpty, WidgetFrame } from "../../../components/island-widget/WidgetFrame";
import { WidgetOpenButton } from "../../../components/island-widget/WidgetOpenButton";
import { useTranslation } from "../../../i18n";
import { runIslandAction } from "../../plugin-kernel/useIslandContributions";
import { defineSlot, type IslandWidgetMeta, type IslandWidgetProps } from "../../plugin-kernel/slots";
import { focusAgentWindow, type AgentSessionSummary } from "../api";
import { sessionName } from "../session";
import { isTestSession } from "../testNotice";
import { agentPage, agentShell } from "./islandState";
import { AGENT_SESSIONS_WIDGET, OPEN_AGENTS_ACTION } from "./widgets.ts";
import "./widget.css";

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

const openAgents = () => void runIslandAction(OPEN_AGENTS_ACTION);

function AgentSessionsWidget({ height }: IslandWidgetProps) {
  const text = useTranslation();
  const t = text.islandWidgets;
  const { listed } = agentShell.use();
  const unseen = agentPage.use()?.unseen;
  const open = listed.filter((session) => !session.closed);
  const ordered = [...open.filter((session) => session.phase === "waiting"), ...open.filter((session) => session.phase !== "waiting")];
  const shown = ordered.slice(0, Math.max(1, Math.floor((height - HEAD_PX) / ROW_PX)));
  const jump = (session: AgentSessionSummary) => {
    if (isTestSession(session)) return openAgents();
    unseen?.markSeen(session);
    void focusAgentWindow(session.provider, session.cwd, session.title, session.remoteHost ? "" : session.sessionId)
      .then((found) => {
        if (!found) openAgents();
      })
      .catch((error: unknown) => {
        console.error("Failed to focus the agent window", error);
        openAgents();
      });
  };
  const aside = (
    <>
      {open.length > 0 ? t.content.sessionCount(open.length) : null}
      <WidgetOpenButton label={text.agent.sessions.open} onOpen={openAgents} />
    </>
  );
  return (
    <WidgetFrame icon={Bot} title={t.widgets.agentSessions} aside={aside}>
      {shown.length === 0 ? (
        <WidgetEmpty>{t.content.noSessions}</WidgetEmpty>
      ) : (
        <ul className="island-widget__list">
          {shown.map((session) => {
            const name = sessionName(session);
            const title = name.title || name.label;
            const waiting = session.phase === "waiting";
            return (
              <li key={`${session.provider}-${session.sessionId}`}>
                <button
                  className="island-widget__row agent-widget__row"
                  type="button"
                  data-waiting={waiting || undefined}
                  title={waiting ? `${text.agent.phase.waiting} · ${text.agent.sessions.focus(title)}` : text.agent.sessions.focus(title)}
                  onClick={clickOnly(() => jump(session))}
                >
                  <span className="island-widget__dot" data-tone={TONES[session.phase]} aria-hidden="true" />
                  <span>{title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetFrame>
  );
}

widgetSlot.add({ ...AGENT_SESSIONS_WIDGET, component: AgentSessionsWidget }, AGENT_SESSIONS_WIDGET.owner);
