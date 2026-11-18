export type KnownMediaSource = {
  id: string;
  label: string;
  lastSeen: number;
};

export const SOURCE_EXPIRE_MS = 60 * 24 * 60 * 60 * 1000;
export const SOURCE_TOUCH_MS = 60 * 60 * 1000;

type LiveSession = { id: string; label: string; playing?: boolean };

export function pickEffectiveMediaTarget(
  sessions: LiveSession[],
  priority: KnownMediaSource[],
): string | null {
  if (sessions.length === 0) {
    return null;
  }
  const present = new Map(sessions.map((session) => [session.id, session]));
  for (const source of priority) {
    if (present.get(source.id)?.playing) {
      return source.id;
    }
  }
  for (const session of sessions) {
    if (session.playing) {
      return session.id;
    }
  }
  for (const source of priority) {
    if (present.has(source.id)) {
      return source.id;
    }
  }
  return sessions[0]?.id ?? null;
}

export function mergeSessionsWithCustomPlayers(
  liveSessions: { id: string; label: string; playing: boolean }[],
  customPlayers: { id: string; label: string }[],
): { id: string; label: string; playing: boolean }[] {
  if (customPlayers.length === 0) {
    return liveSessions;
  }
  const merged = [...liveSessions];
  const seen = new Set(liveSessions.map((session) => session.id.toLowerCase()));
  for (const player of customPlayers) {
    const key = player.id.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push({ id: player.id, label: player.label, playing: false });
  }
  return merged;
}

export function parseMusicSourcePriority(
  raw: unknown,
  now: number,
): KnownMediaSource[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const result: KnownMediaSource[] = [];
  for (const item of raw as Partial<KnownMediaSource>[]) {
    if (
      typeof item?.id !== "string" ||
      item.id.length === 0 ||
      typeof item.label !== "string" ||
      seen.has(item.id)
    ) {
      continue;
    }
    seen.add(item.id);
    const lastSeen =
      typeof item.lastSeen === "number" && Number.isFinite(item.lastSeen)
        ? item.lastSeen
        : now;
    result.push({ id: item.id, label: item.label, lastSeen });
  }
  return result;
}

export function syncMusicSources(
  current: KnownMediaSource[],
  sessions: LiveSession[],
  now: number,
): KnownMediaSource[] {
  const live = new Map(sessions.map((session) => [session.id, session]));
  let changed = false;
  const next: KnownMediaSource[] = [];
  for (const source of current) {
    const session = live.get(source.id);
    if (session) {
      if (now - source.lastSeen >= SOURCE_TOUCH_MS || source.lastSeen > now) {
        changed = true;
        next.push({ ...source, lastSeen: now });
      } else {
        next.push(source);
      }
    } else if (now - source.lastSeen > SOURCE_EXPIRE_MS) {
      changed = true;
    } else {
      next.push(source);
    }
  }
  const known = new Set(current.map((source) => source.id));
  for (const session of sessions) {
    if (!known.has(session.id)) {
      known.add(session.id);
      changed = true;
      next.push({ id: session.id, label: session.label, lastSeen: now });
    }
  }
  return changed ? next : current;
}
