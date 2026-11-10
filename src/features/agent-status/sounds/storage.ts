import { readJson, writeJson } from "../../../lib/storage.ts";
import { islandRanBefore } from "../../appearance/installState.ts";
import { AGENT_SOUND_EVENTS, type AgentSoundEvent } from "./events.ts";

export const AGENT_SOUNDS_STORAGE_KEY = "fuyu-agent-sounds";

/** The sounds that ship with the island; any other value is an imported pack's id. */
export const BUILTIN_PACK = "builtin";

export type AgentSoundSettings = {
  enabled: boolean;
  /** 0-100. */
  volume: number;
  /** BUILTIN_PACK or an imported pack's id. */
  pack: string;
  events: Record<AgentSoundEvent, boolean>;
  /** Stay quiet while the session's terminal or window is in front. */
  quietWhenInFront: boolean;
  quietHours: { enabled: boolean; start: string; end: string };
};

/** A new install plays every event, the terminal in front or not. */
export const DEFAULT_AGENT_SOUND_SETTINGS: AgentSoundSettings = {
  enabled: true,
  volume: 70,
  pack: BUILTIN_PACK,
  events: { start: true, complete: true, error: true, approval: true, question: true, ack: true, compact: true, idle: true, quotaLow: true, quotaReset: true },
  quietWhenInFront: false,
  quietHours: { enabled: false, start: "22:00", end: "08:00" },
};

/**
 * What islands that ran before 0.3.5-beta.5 had, for their saved settings' missing fields and for
 * islands from before sounds: starting a session, sending a prompt and an unread finished session
 * stayed quiet, and so did a session whose terminal was in front.
 */
const EARLIER_AGENT_SOUND_SETTINGS: AgentSoundSettings = {
  ...DEFAULT_AGENT_SOUND_SETTINGS,
  events: { ...DEFAULT_AGENT_SOUND_SETTINGS.events, start: false, ack: false, idle: false },
  quietWhenInFront: true,
};

const CLOCK = /^\d{1,2}:\d{2}$/;

/** Saved settings with missing or malformed fields as earlier islands had them; nothing saved is a new install's default. */
export function normalizeAgentSoundSettings(value: unknown): AgentSoundSettings {
  if (!value || typeof value !== "object") return DEFAULT_AGENT_SOUND_SETTINGS;
  const fallback = EARLIER_AGENT_SOUND_SETTINGS;
  const raw = value as Record<string, unknown>;
  const bool = (input: unknown, otherwise: boolean) => (typeof input === "boolean" ? input : otherwise);
  const rawEvents = raw.events && typeof raw.events === "object" ? (raw.events as Record<string, unknown>) : {};
  const rawQuiet = raw.quietHours && typeof raw.quietHours === "object" ? (raw.quietHours as Record<string, unknown>) : {};
  const clock = (input: unknown, otherwise: string) => (typeof input === "string" && CLOCK.test(input) ? input : otherwise);
  return {
    enabled: bool(raw.enabled, fallback.enabled),
    volume: typeof raw.volume === "number" && Number.isFinite(raw.volume) ? Math.min(100, Math.max(0, Math.round(raw.volume))) : fallback.volume,
    pack: typeof raw.pack === "string" && /^(plugin:[a-z0-9.-]{3,64}|[a-z0-9-]{1,64})$/.test(raw.pack) ? raw.pack : fallback.pack,
    events: Object.fromEntries(AGENT_SOUND_EVENTS.map((event) => [event, bool(rawEvents[event], fallback.events[event])])) as Record<AgentSoundEvent, boolean>,
    quietWhenInFront: bool(raw.quietWhenInFront, fallback.quietWhenInFront),
    quietHours: {
      enabled: bool(rawQuiet.enabled, fallback.quietHours.enabled),
      start: clock(rawQuiet.start, fallback.quietHours.start),
      end: clock(rawQuiet.end, fallback.quietHours.end),
    },
  };
}

export function loadAgentSoundSettings(): AgentSoundSettings {
  const saved = readJson(AGENT_SOUNDS_STORAGE_KEY);
  if (saved === undefined && islandRanBefore()) return EARLIER_AGENT_SOUND_SETTINGS;
  return normalizeAgentSoundSettings(saved);
}

export function saveAgentSoundSettings(settings: AgentSoundSettings) {
  writeJson(AGENT_SOUNDS_STORAGE_KEY, settings);
}
