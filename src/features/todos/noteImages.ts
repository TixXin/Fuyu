const IMAGE = /!\[[^\]\n]*\]\(<([^>\n]+\.png)>\)/gi;

export function noteImagePaths(text: string | null | undefined): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  for (const match of text.matchAll(IMAGE)) seen.add(match[1]);
  return [...seen];
}
