import { readJson, writeJson } from "../../../lib/storage.ts";

export const AGENT_PUSH_STORAGE_KEY = "fuyu-agent-push";

/** What a session did that can go to the phone. */
export const AGENT_PUSH_EVENTS = ["waiting", "completed", "failed"] as const;
export type AgentPushEvent = (typeof AGENT_PUSH_EVENTS)[number];

/** Push only after this many minutes without keyboard or mouse input (or at once when locked); 0 pushes always. */
export const AGENT_PUSH_AWAY_MINUTES = [0, 2, 5, 10] as const;

/** Where a push goes: Bark, or a chat of a cc-connect bot (the built-in plugin focusd.cc-connect). */
export const AGENT_PUSH_CHANNELS = ["bark", "ccConnect"] as const;
export type AgentPushChannel = (typeof AGENT_PUSH_CHANNELS)[number];

/** The key of this computer among the hosts; an SSH computer's is its name, as in `remoteHost`. */
export const LOCAL_HOST = "";

/**
 * A chat of a cc-connect project that gets the push. `agent` is the project's agent type
 * ("claudecode", "codex") as it was when the chat was picked: the takeover commands only work for
 * sessions of that agent.
 */
export type CcConnectPushChat = { project: string; key: string; agent: string | null };

/**
 * One computer's cc-connect: the chats its sessions are pushed to, the program there (empty: find
 * it; this computer's is the plugin's setting), and, for an SSH computer without cc-connect,
 * whether this computer's chats push for it instead (without takeover commands).
 */
export type CcConnectPushHost = { chats: CcConnectPushChat[]; path: string; viaLocal: boolean };

const MAX_CHATS = 20;
const MAX_HOSTS = 20;

export type AgentPushSettings = {
  enabled: boolean;
  /** A bark-server's address; empty is Bark's own (https://api.day.app). */
  server: string;
  events: Record<AgentPushEvent, boolean>;
  awayMinutes: number;
  channel: AgentPushChannel;
  /** The computers whose sessions are not pushed (LOCAL_HOST for this one); any other is. */
  mutedHosts: string[];
  /** By computer (LOCAL_HOST for this one). */
  ccConnect: Record<string, CcConnectPushHost>;
};

export const EMPTY_PUSH_HOST: CcConnectPushHost = { chats: [], path: "", viaLocal: false };

export const DEFAULT_AGENT_PUSH_SETTINGS: AgentPushSettings = {
  enabled: false,
  server: "",
  events: { waiting: true, completed: true, failed: true },
  // Pushing to the phone while sitting at the computer is noise.
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

/** The cc-connect settings of a computer (LOCAL_HOST for this one). */
export function pushHost(settings: AgentPushSettings, host: string): CcConnectPushHost {
  return settings.ccConnect[host] ?? EMPTY_PUSH_HOST;
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
  // Before computers had their own: one project of this computer, `{ project, chats: [key] }`.
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
  return { chats: normalizeChats(raw.chats), path: text(raw.path, 1024), viaLocal: raw.viaLocal === true };
}

function normalizeChats(value: unknown): CcConnectPushChat[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const chats: CcConnectPushChat[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const raw = entry as Record<string, unknown>;
    const project = text(raw.project, 200);
    // A chat key is `<platform>:<chat>:<user>`; anything else would only fail to send.
    const key = typeof raw.key === "string" && raw.key.includes(":") && raw.key.length <= 256 ? raw.key : "";
    if (!project || !key || seen.has(`${project}\n${key}`)) continue;
    seen.add(`${project}\n${key}`);
    chats.push({ project, key, agent: typeof raw.agent === "string" ? text(raw.agent, 64) || null : null });
  }
  return chats.slice(0, MAX_CHATS);
}

/** Where a computer's sessions are pushed: through the cc-connect of `via` (LOCAL_HOST or `host`) to `chats`. */
export type PushRoute = { via: string; path: string; chats: CcConnectPushChat[]; takeover: boolean };

/**
 * Each computer's sessions go out through its own cc-connect, whose bots can take them over. An
 * SSH computer set to `viaLocal` borrows this computer's chats instead, without takeover: this
 * computer's cc-connect cannot resume a session that lives on another.
 */
export function pushRoute(settings: AgentPushSettings, host: string): PushRoute {
  const own = pushHost(settings, host);
  if (host !== LOCAL_HOST && own.viaLocal) return { via: LOCAL_HOST, path: "", chats: pushHost(settings, LOCAL_HOST).chats, takeover: false };
  return { via: host, path: own.path, chats: own.chats, takeover: true };
}
