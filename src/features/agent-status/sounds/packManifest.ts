import { AGENT_SOUND_EVENTS, isAgentSoundEvent, type AgentSoundEvent } from "./events.ts";

export const PACK_MANIFEST_NAME = "focusd-sound-pack.json";

export const SOUND_FILE_EXTENSIONS = ["wav", "mp3", "ogg", "m4a", "flac"] as const;

const CESP_EVENTS: Record<string, AgentSoundEvent> = {
  "session.start": "start",
  "task.complete": "complete",
  "task.error": "error",
  "input.required": "approval",
  "input.question": "question",
  "task.acknowledge": "ack",
  "resource.limit": "compact",
  "idle.reminder": "idle",
  "usage.warning": "quotaLow",
  "usage.reset": "quotaReset",
};

const NAME_HINTS: [AgentSoundEvent, string[]][] = [
  ["start", ["session-start", "start"]],
  ["complete", ["task-complete", "complete", "done", "finish"]],
  ["error", ["task-error", "error", "fail"]],
  ["question", ["question", "ask"]],
  ["approval", ["input-required", "approval", "permission"]],
  ["ack", ["task-acknowledge", "acknowledge", "ack"]],
  ["compact", ["resource-limit", "compact", "context"]],
  ["idle", ["idle"]],
  ["quotaReset", ["usage-reset", "quota-reset"]],
  ["quotaLow", ["usage-warning", "quota-low", "quota"]],
];

export type SoundPackPlan = {
  name: string;
  author: string;
  license: string;
  sounds: Partial<Record<AgentSoundEvent, string>>;
};

export type SoundPackProblem = "noSounds";

type JsonFile = { path: string; text: string };

const baseName = (path: string) => path.split(/[\\/]/).pop() ?? path;
const folderOf = (path: string) => path.split(/[\\/]/).slice(0, -1).join("/");
const textField = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, 120) : "");

export function isSoundFile(path: string): boolean {
  const extension = baseName(path).split(".").pop()?.toLowerCase() ?? "";
  return (SOUND_FILE_EXTENSIONS as readonly string[]).includes(extension);
}

function eventFor(key: string): AgentSoundEvent | null {
  if (isAgentSoundEvent(key)) return key;
  return CESP_EVENTS[key.trim().toLowerCase()] ?? null;
}

function resolve(file: unknown, manifestPath: string, soundFiles: string[]): string | null {
  if (typeof file !== "string" || !file.trim()) return null;
  const wanted = [folderOf(manifestPath), file.trim()].filter(Boolean).join("/").replace(/\\/g, "/").toLowerCase();
  return soundFiles.find((path) => path.replace(/\\/g, "/").toLowerCase() === wanted)
    ?? soundFiles.find((path) => baseName(path).toLowerCase() === baseName(file).toLowerCase())
    ?? null;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function listEntries(value: unknown): Record<string, unknown>[] {
  const list = Array.isArray(value) ? value : value && typeof value === "object" && Array.isArray((value as { sounds?: unknown }).sounds) ? (value as { sounds: unknown[] }).sounds : [];
  return list.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object");
}

export function planSoundPack(folderName: string, paths: string[], jsonFiles: JsonFile[]): SoundPackPlan | SoundPackProblem {
  const soundFiles = paths.filter(isSoundFile);
  const plan: SoundPackPlan = { name: folderName.trim() || "Sound pack", author: "", license: "", sounds: {} };

  const own = jsonFiles.find((file) => baseName(file.path).toLowerCase() === PACK_MANIFEST_NAME);
  const ownJson = own ? parseJson(own.text) : undefined;
  if (own && ownJson && typeof ownJson === "object" && !Array.isArray(ownJson)) {
    const manifest = ownJson as Record<string, unknown>;
    plan.name = textField(manifest.name) || plan.name;
    plan.author = textField(manifest.author);
    plan.license = textField(manifest.license);
    const sounds = manifest.sounds && typeof manifest.sounds === "object" ? (manifest.sounds as Record<string, unknown>) : {};
    for (const [key, file] of Object.entries(sounds)) {
      const event = eventFor(key);
      const path = resolve(file, own.path, soundFiles);
      if (event && path && !plan.sounds[event]) plan.sounds[event] = path;
    }
  }

  for (const json of jsonFiles) {
    if (json === own) continue;
    for (const entry of listEntries(parseJson(json.text))) {
      const category = entry.cesp_category ?? entry.category ?? entry.event;
      const event = typeof category === "string" ? eventFor(category) : null;
      const path = resolve(entry.file, json.path, soundFiles);
      if (event && path && !plan.sounds[event]) plan.sounds[event] = path;
    }
  }

  const used = new Set(Object.values(plan.sounds));
  for (const path of soundFiles.filter((file) => !used.has(file))) {
    const name = baseName(path).toLowerCase().replace(/\.[^.]+$/, "").replace(/[\s._]+/g, "-");
    const hit = NAME_HINTS.find(([event, words]) => !plan.sounds[event] && words.some((word) => name.includes(word)));
    if (hit) plan.sounds[hit[0]] = path;
  }

  if (!plan.sounds.question && plan.sounds.approval) plan.sounds.question = plan.sounds.approval;
  return AGENT_SOUND_EVENTS.some((event) => plan.sounds[event]) ? plan : "noSounds";
}
