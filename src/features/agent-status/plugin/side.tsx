import { useTranslation } from "../../../i18n";
import { defineSlot } from "../../plugin-kernel/slots";
import { useIslandContributed } from "../../plugin-kernel/useIslandContributions";
import { agentShell } from "./islandState";

type SideContext = {
  onOpenPage: (page: "agents") => void;
};

const sideSlot = defineSlot<SideContext>("island.side/v1");

function AgentRing({ onOpenPage }: SideContext) {
  const t = useTranslation();
  const agentVisualState = useIslandContributed().status?.state ?? "idle";
  const count = agentShell.use().activeCount;
  return (
    <button
      type="button"
      className={`island-side-ring island-side-ring--${agentVisualState}`}
      aria-label={t.agent.sessions.activeCount(count)}
      onClick={(event) => {
        event.stopPropagation();
        onOpenPage("agents");
      }}
    >
      {count > 0 ? count : <span className="island-side-ring__dot" aria-hidden="true" />}
    </button>
  );
}

sideSlot.add({ id: "agent", order: 10, component: AgentRing });
