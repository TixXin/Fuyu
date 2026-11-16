const MAX_PROJECT_LENGTH = 20;

export function readProject(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const name = [...value.trim()].slice(0, MAX_PROJECT_LENGTH).join("");
  return name || undefined;
}

export function splitProjectPrefix(text: string): { title: string; project?: string } {
  const match = /^#([^\s#]+)\s+(\S.*)$/su.exec(text.trim());
  if (!match || /^\d+$/u.test(match[1])) return { title: text.trim() };
  return { title: match[2].trim(), project: readProject(match[1]) };
}
