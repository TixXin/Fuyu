import type { ClipboardHistoryItem, ClipboardLink, ClipboardLinkSettings, ClipboardLinks } from "./api";
import { contentKind } from "./contentKind.ts";

export function siteMatches(host: string, site: string): boolean {
  const name = host.toLowerCase().replace(/^www\./, "");
  return name === site || name.endsWith(`.${site}`);
}

export function parseSites(text: string): string[] {
  return text
    .split(/[\s,，;；]+/)
    .map((site) => site.trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, "").split(/[/?#]/)[0].replace(/^\*\./, "").replace(/^www\./, ""))
    .filter((site, index, all) => site.length > 0 && all.indexOf(site) === index);
}

export function offeredLink(item: ClipboardHistoryItem, settings: ClipboardLinkSettings): URL | null {
  if (!settings.notice) return null;
  const kind = contentKind(item);
  if (kind?.kind !== "link") return null;
  const text = (item.text ?? item.preview).trim();
  if (settings.matching === "web" && !/^https?:\/\//i.test(text)) return null;
  const host = kind.url.hostname;
  if (settings.blockedSites.some((site) => siteMatches(host, site))) return null;
  if (settings.onlySites.length > 0 && !settings.onlySites.some((site) => siteMatches(host, site))) return null;
  return kind.url;
}

export function itemLink(item: ClipboardHistoryItem): URL | null {
  const kind = contentKind(item);
  return kind?.kind === "link" ? kind.url : null;
}

export function moveIndex<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return next;
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved);
  return next;
}

const strings = (value: unknown) => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []);

export const DEFAULT_CLIPBOARD_LINKS: ClipboardLinks = {
  version: 1,
  settings: { notice: true, matching: "any", blockedSites: [], onlySites: [] },
  links: [],
};

export function normalizeClipboardLinks(value: unknown): ClipboardLinks {
  if (!value || typeof value !== "object") return DEFAULT_CLIPBOARD_LINKS;
  const raw = value as { settings?: Partial<Record<keyof ClipboardLinkSettings, unknown>>; links?: unknown };
  const settings = raw.settings ?? {};
  const links = Array.isArray(raw.links)
    ? raw.links.filter((link): link is ClipboardLink => Boolean(link) && typeof (link as ClipboardLink).id === "string" && typeof (link as ClipboardLink).url === "string")
      .map((link) => ({ ...link, title: typeof link.title === "string" ? link.title : "" }))
    : [];
  return {
    version: 1,
    settings: {
      notice: settings.notice !== false,
      matching: settings.matching === "web" ? "web" : "any",
      blockedSites: strings(settings.blockedSites),
      onlySites: strings(settings.onlySites),
    },
    links,
  };
}
