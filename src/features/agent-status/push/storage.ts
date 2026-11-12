import { readJson, writeJson } from "../../../lib/storage.ts";

export const AGENT_PUSH_STORAGE_KEY = "fuyu-agent-push";

export const AGENT_PUSH_EVENTS = ["waiting", "completed", "failed"] as const;
export type AgentPushEvent = (typeof AGENT_PUSH_EVENTS)[number];

export const AGENT_PUSH_AWAY_MINUTES = [0, 2, 5, 10] as const;

export const AGENT_PUSH_CHANNELS = ["bark", "ccConnect"] as const;
export type AgentPushChannel = (typeof AGENT_PUSH_CHANNELS)[number];

export const LOCAL_HOST = "";

export type CcConnectPushChat = { project: string; key: string; agent: string | null };

export type CcConnectPushHost = { chats: CcConnectPushChat[]; viaLocal: boolean };

const MAX_CHATS = 20;
const MAX_HOSTS = 20;

export type AgentPushSettings = {
  enabled: boolean;
  server: string;
  events: Record<AgentPushEvent, boolean>;
  awayMinutes: number;
  channel: AgentPushChannel;
  mutedHosts: string[];
  ccConnect: Record<string, CcConnectPushHost>;
};

export const EMPTY_PUSH_HOST: CcConnectPushHost = { chats: [], viaLocal: false };

export const DEFAULT_AGENT_PUSH_SETTINGS: AgentPushSettings = {
  enabled: false,
  server: "",
  events: { waiting: true, completed: true, failed: true },
  awayMinutes: 5,
  channel: "bark",
  mutedHosts: [],
  ccConnect: {},
};

export function normalizeAgentPushSettings(value: unknown): AgentPushSettings {
  const fallback = DEFAULT_AGENT_PUSH_SETTINGS;
  if (!value || typeof value !== "object") return fallback;
  const raw = value as Record<string, unknown>;
  const rawEvents = raw.events && typeof raw.events === "object" ? (raw.events as Record<string, unknown>) : {};
  const bool = (input: unknown, otherwise: boolean) => (typeof input === "boolean" ? input : otherwise);
  return {
    enabled: bool(raw.enabled, fallback.enabled),
    server: typeof raw.server === "string" ? raw.server.trim().slice(0, 200) : fallback.server,
    events: Object.fromEntries(AGENT_PUSH_EVENTS.map((event) => [event, bool(rawEvents[event], fallback.events[event])])) as Record<AgentPushEvent, boolean>,
    awayMinutes: (AGENT_PUSH_AWAY_MINUTES as readonly unknown[]).includes(raw.awayMinutes) ? (raw.awayMinutes as number) : fallback.awayMinutes,
    channel: (AGENT_PUSH_CHANNELS as readonly unknown[]).includes(raw.channel) ? (raw.channel as AgentPushChannel) : fallback.channel,
    mutedHosts: Array.isArray(raw.mutedHosts) ? [...new Set(raw.mutedHosts.filter(isHost))].slice(0, MAX_HOSTS) : [],
    ccConnect: normalizeHosts(raw.ccConnect),
  };
}

export function loadAgentPushSettings(): AgentPushSettings {
  return normalizeAgentPushSettings(readJson(AGENT_PUSH_STORAGE_KEY));
}

export function saveAgentPushSettings(settings: AgentPushSettings) {
  writeJson(AGENT_PUSH_STORAGE_KEY, settings);
}

export function pushHost(settings: AgentPushSettings, host: string): CcConnectPushHost {
  return settings.ccConnect[host] ?? (host === LOCAL_HOST ? EMPTY_PUSH_HOST : { chats: [], viaLocal: true });
}

function isHost(value: unknown): value is string {
  return typeof value === "string" && value.length <= 128;
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeHosts(value: unknown): Record<string, CcConnectPushHost> {
  if (!value || typeof value !== "object") return {};
  const raw = value as Record<string, unknown>;
  if (typeof raw.project === "string" && Array.isArray(raw.chats)) {
    const project = text(raw.project, 200);
    const chats = raw.chats.map((key) => ({ project, key, agent: "claudecode" }));
    return { [LOCAL_HOST]: { ...EMPTY_PUSH_HOST, chats: normalizeChats(chats) } };
  }
  const hosts = Object.entries(raw).filter(([host]) => isHost(host)).slice(0, MAX_HOSTS);
  return Object.fromEntries(hosts.map(([host, entry]) => [host, normalizeHost(entry)]));
}

function normalizeHost(value: unknown): CcConnectPushHost {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return { chats: normalizeChats(raw.chats), viaLocal: raw.viaLocal === true };
}

function normalizeChats(value: unknown): CcConnectPushChat[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const chats: CcConnectPushChat[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const raw = entry as Record<string, unknown>;
    const project = text(raw.project, 200);
    const key = typeof raw.key === "string" && raw.key.includes(":") && raw.key.length <= 256 ? raw.key : "";
    if (!project || !key || seen.has(`${project}\n${key}`)) continue;
    seen.add(`${project}\n${key}`);
    chats.push({ project, key, agent: typeof raw.agent === "string" ? text(raw.agent, 64) || null : null });
  }
  return chats.slice(0, MAX_CHATS);
}

export type PushRoute = { via: string; chats: CcConnectPushChat[]; takeover: boolean };

export function pushRoute(settings: AgentPushSettings, host: string): PushRoute {
  const own = pushHost(settings, host);
  if (host !== LOCAL_HOST && own.viaLocal) return { via: LOCAL_HOST, chats: pushHost(settings, LOCAL_HOST).chats, takeover: false };
  return { via: host, chats: own.chats, takeover: true };
}
