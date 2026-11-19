export type LocalApiSender = { id: string; source: string; muted: boolean };

export function localApiSenders(owner: string, senders: readonly string[], mutes: readonly string[]): LocalApiSender[] {
  const prefix = `${owner}/`;
  const ids = [...new Set([...senders, ...mutes])].filter((id) => id.startsWith(prefix) && id.length > prefix.length);
  return ids
    .map((id) => ({ id, source: id.slice(prefix.length), muted: mutes.includes(id) }))
    .sort((left, right) => left.source.localeCompare(right.source));
}
