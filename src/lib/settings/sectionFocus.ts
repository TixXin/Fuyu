const listeners = new Set<(section: string) => void>();

export function focusSection(section: string) {
  for (const listener of listeners) listener(section);
}

export function onSectionFocus(listener: (section: string) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
