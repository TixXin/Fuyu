import { remotePath, sendCcConnectMessage, sendCcConnectRemoteMessage } from "../../cc-connect";
import type { AgentAlert, AgentAlertKind } from "../alerts";
import { sessionProject } from "../sessionList";
import { AGENT_PROVIDER_LABELS } from "../status";
import { getAgentPushDetail, getUserIdleSeconds, isSessionLocked, NO_PUSH_DETAIL, sendBarkPush } from "./api";
import { ccConnectText, pushBody, takeoverCommands } from "./pushText";
import { LOCAL_HOST, pushRoute, type AgentPushSettings } from "./storage";

export const PUSH_GROUP = "Fuyu";

export type PushLabels = {
  kinds: Record<Exclude<AgentAlertKind, "started">, (agent: string) => string>;
  takeover: string;
};

export async function isAway(minutes: number) {
  if (minutes === 0) return true;
  const [locked, idle] = await Promise.all([isSessionLocked().catch(() => false), getUserIdleSeconds().catch(() => null)]);
  return locked || idle === null || idle >= minutes * 60;
}

export async function sendPush({ kind, session }: AgentAlert, push: AgentPushSettings, labels: PushLabels, ccConnectPath: string | null) {
  if (kind === "started") return;
  const host = session.remoteHost ?? LOCAL_HOST;
  if (push.mutedHosts.includes(host)) return;
  const agent = AGENT_PROVIDER_LABELS[session.provider];
  const title = session.title ?? sessionProject(session.cwd) ?? agent;
  if (push.channel === "bark") return sendBarkPush(push.server, title, labels.kinds[kind](agent), PUSH_GROUP);

  if (ccConnectPath === null) throw new Error("The cc-connect plugin is off.");
  const detail = await getAgentPushDetail(session.provider, session.sessionId, session.remoteHost ?? null).catch(() => NO_PUSH_DETAIL);
  if (detail.entrypoint === "sdk-cli") return;
  const heading = `${session.remoteHost ? `${session.remoteHost} · ` : ""}${title} · ${labels.kinds[kind](agent)}`;
  const body = pushBody({ kind, session }, detail);
  const route = pushRoute(push, host);
  const results = await Promise.allSettled(
    route.chats.map(({ project, key, agent: projectAgent }) => {
      const commands = route.takeover ? takeoverCommands(session, projectAgent) : [];
      const text = ccConnectText(heading, body, commands, labels.takeover, key.split(":")[0]);
      return route.via === LOCAL_HOST
        ? sendCcConnectMessage(ccConnectPath, project, key, text)
        : sendCcConnectRemoteMessage(route.via, remotePath(route.via), project, key, text);
    }),
  );
  const failed = results.find((result) => result.status === "rejected");
  if (failed) throw failed.reason;
}
