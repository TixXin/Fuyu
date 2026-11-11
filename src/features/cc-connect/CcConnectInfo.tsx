import { CC_CONNECT_AGENT_LABELS, chatLabel, type CcConnectProject } from "./api";

/** "pc · Claude Code": the name, and its agent when known. */
export function projectLabel(projects: CcConnectProject[], name: string) {
  const agent = projects.find((entry) => entry.name === name)?.agent;
  return agent ? `${name} · ${CC_CONNECT_AGENT_LABELS[agent] ?? agent}` : name;
}

/** The project's chats, "Telegram · pj, Discord"; "" when none. */
export function chatsOf(projects: CcConnectProject[], name: string, platforms: Record<string, string>) {
  const project = projects.find((entry) => entry.name === name);
  return (project?.chats ?? []).map((chat) => chatLabel(chat, platforms)).join(", ");
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="plugin-info__row">
      <span>{label}</span>
      <code title={value}>{value}</code>
    </div>
  );
}
