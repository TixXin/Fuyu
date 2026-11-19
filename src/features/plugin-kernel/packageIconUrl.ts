export function packageIconUrl(base: string, id: string, path: string | undefined | null): string | null {
  const match = /^@([^/]+)\/([^/]+)$/.exec(id);
  if (!match || !path) return null;
  const segments = path.split("/").map(encodeURIComponent).join("/");
  return `${base}/packages/@${encodeURIComponent(match[1].toLowerCase())}/${encodeURIComponent(match[2])}/${segments}`;
}
