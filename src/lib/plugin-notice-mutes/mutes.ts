export const NOTICE_SENDERS_LIMIT = 64;

export function normalizeNoticeIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (id !== "" && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function withNoticeMuted(mutes: readonly string[], id: string, muted: boolean): string[] {
  const key = id.trim();
  const rest = mutes.filter((item) => item !== key);
  return muted && key !== "" ? [...rest, key].sort() : rest;
}

export function withNoticeSender(senders: readonly string[], id: string, limit = NOTICE_SENDERS_LIMIT): string[] | null {
  const key = id.trim();
  if (key === "" || senders.includes(key)) return null;
  return [...senders, key].slice(-limit);
}

export function noticeSwitchShown(id: string, declared: boolean, mutes: readonly string[], senders: readonly string[]): boolean {
  return declared || mutes.includes(id) || senders.includes(id);
}
