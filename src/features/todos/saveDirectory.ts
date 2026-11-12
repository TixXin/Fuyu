function comparable(directory: string) {
  return directory.trim().replace(/[\\/]+$/, "").replace(/\//g, "\\").toLowerCase();
}

export function sameDirectory(a: string, b: string) {
  return comparable(a) !== "" && comparable(a) === comparable(b);
}

export function movedSaveDirectory(stored: string, legacyDefault: string, currentDefault: string): string | null {
  if (!sameDirectory(stored, legacyDefault) || sameDirectory(currentDefault, legacyDefault) || !currentDefault.trim()) return null;
  return currentDefault.trim();
}
