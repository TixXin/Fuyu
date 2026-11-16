import { useTranslation } from "../../i18n";
import type { SessionHost } from "./api";
import { useHostIcon } from "./useHostIcon";
import type { AgentHostDisplay } from "./agentSettings";

export function SessionHostLabel({ host, display, badge = false }: { host: SessionHost; display: AgentHostDisplay; badge?: boolean }) {
  const t = useTranslation();
  const icon = useHostIcon(display === "name" ? null : host.exe);
  const label = t.agent.sessions.runsIn(host.name);
  if (display === "off") return null;

  if (badge) {
    return display !== "name" && icon ? <img className="agent-session__host-badge" src={icon} alt={label} title={label} width={10} height={10} draggable={false} /> : null;
  }
  if (display === "icon" && !icon) return null;

  return (
    <span className="agent-session__host" title={label}>
      {display !== "name" && icon && <img className="agent-session__host-icon" src={icon} alt={label} width={13} height={13} />}
      {display !== "icon" && <span className="agent-session__host-name">{host.name}</span>}
    </span>
  );
}
