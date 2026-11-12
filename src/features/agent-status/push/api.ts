import { invoke } from "@tauri-apps/api/core";

export function hasBarkKey() {
  return invoke<boolean>("has_bark_key");
}

export function saveBarkKey(key: string) {
  return invoke<void>("save_bark_key", { key });
}

export function deleteBarkKey() {
  return invoke<void>("delete_bark_key");
}

export function sendBarkPush(server: string, title: string, body: string, group: string) {
  return invoke<void>("send_bark_push", { server, title, body, group });
}

export function getUserIdleSeconds() {
  return invoke<number | null>("get_user_idle_seconds");
}

export function isSessionLocked() {
  return invoke<boolean>("is_session_locked");
}

export type AgentPushDetail = {
  entrypoint: string | null;
  wait: { kind: "question" | "plan" | "reply"; text: string } | null;
};

export const NO_PUSH_DETAIL: AgentPushDetail = { entrypoint: null, wait: null };

export function getAgentPushDetail(provider: string, sessionId: string, remoteHost: string | null) {
  return invoke<AgentPushDetail>("get_agent_push_detail", { provider, sessionId, remoteHost });
}
