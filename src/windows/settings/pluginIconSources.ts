import { isMacOS } from "../../lib/platform";

const PACKAGE_BASE = `${isMacOS ? "fuyu-plugin://localhost" : "http://fuyu-plugin.localhost"}/packages`;

export function packageIconUrl(id: string, path: string | undefined): string | null {
  const match = /^@([^/]+)\/([^/]+)$/.exec(id);
  if (!match || !path) return null;
  const segments = path.split("/").map(encodeURIComponent).join("/");
  return `${PACKAGE_BASE}/@${encodeURIComponent(match[1].toLowerCase())}/${encodeURIComponent(match[2])}/${segments}`;
}

export function iconSources(...urls: (string | null | undefined)[]): string[] {
  return [...new Set(urls.filter((url): url is string => typeof url === "string" && url !== ""))];
}

export function pluginInitial(title: string): string {
  return (Array.from(title.replace(/^@[^/]+\//, "").trim())[0] ?? "?").toUpperCase();
}
