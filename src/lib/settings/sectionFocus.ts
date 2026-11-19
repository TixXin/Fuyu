const listeners = new Set<(section: string) => void>();
const PENDING_MS = 3_000;
let pending: { section: string; at: number } | null = null;

export function focusSection(section: string) {
  pending = { section, at: Date.now() };
  for (const listener of listeners) listener(section);
}

export function takePendingSection(section: string): boolean {
  if (pending?.section !== section || Date.now() - pending.at > PENDING_MS) return false;
  pending = null;
  return true;
}

export function onSectionFocus(listener: (section: string) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
