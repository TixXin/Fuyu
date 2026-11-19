export const COMMUNITY_BASE_URL = "https://raw.githubusercontent.com/TixXin/fuyu/main/docs/assets/community/";
export const COMMUNITY_PAGE_URL = "https://github.com/TixXin/fuyu/tree/main/docs/assets/community";
export const COMMUNITY_TIMEOUT_MS = 6_000;

export type CommunityPlatform = "wechat" | "qq" | "discord" | "telegram" | "other";
export type CommunityLocale = "zh-CN" | "en";

export type CommunityGroup = {
  id: string;
  platform: CommunityPlatform;
  name: Record<CommunityLocale, string>;
  note: Record<CommunityLocale, string> | null;
  qr: string | null;
  expiresAt: string | null;
  number: string | null;
  link: string | null;
  locales: CommunityLocale[] | null;
};

export type CommunitySource = { name: string; prefix: string };

export type CommunityList = { groups: CommunityGroup[]; source: CommunitySource };

export const COMMUNITY_SOURCES: readonly CommunitySource[] = Object.freeze([
  { name: "GitHub", prefix: "" },
  { name: "ghfast.top", prefix: "https://ghfast.top/" },
  { name: "gh-proxy.com", prefix: "https://gh-proxy.com/" },
]);

const PLATFORMS = new Set<CommunityPlatform>(["wechat", "qq", "discord", "telegram", "other"]);
const LOCALES: CommunityLocale[] = ["zh-CN", "en"];
const IMAGE_NAME = /^[a-z0-9][a-z0-9-]*\.(png|jpe?g|webp)$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function communityUrl(source: CommunitySource, file: string) {
  return `${source.prefix}${COMMUNITY_BASE_URL}${file}`;
}

export function imageSourcesFrom(first: CommunitySource): CommunitySource[] {
  return [first, ...COMMUNITY_SOURCES.filter((source) => source.name !== first.name)];
}

function text(value: unknown): Record<CommunityLocale, string> | null {
  if (typeof value === "string" && value.trim()) return { "zh-CN": value.trim(), en: value.trim() };
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const zh = typeof record["zh-CN"] === "string" ? record["zh-CN"].trim() : "";
  const en = typeof record.en === "string" ? record.en.trim() : "";
  if (!zh && !en) return null;
  return { "zh-CN": zh || en, en: en || zh };
}

function httpsLink(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function parseGroup(value: unknown): CommunityGroup | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const name = text(item.name);
  if (typeof item.id !== "string" || !item.id || !name) return null;
  const platform = PLATFORMS.has(item.platform as CommunityPlatform) ? (item.platform as CommunityPlatform) : "other";
  const qr = typeof item.qr === "string" && IMAGE_NAME.test(item.qr) ? item.qr : null;
  const number = typeof item.number === "string" && /^[\w-]{1,32}$/.test(item.number) ? item.number : null;
  const link = httpsLink(item.link);
  if (!qr && !number && !link) return null;
  const locales = Array.isArray(item.locales) ? LOCALES.filter((locale) => (item.locales as unknown[]).includes(locale)) : null;
  return {
    id: item.id,
    platform,
    name,
    note: text(item.note),
    qr,
    expiresAt: typeof item.expiresAt === "string" && DATE.test(item.expiresAt) ? item.expiresAt : null,
    number,
    link,
    locales: locales && locales.length > 0 ? locales : null,
  };
}

export function parseCommunityList(raw: unknown): CommunityGroup[] | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  if (data.version !== 1 || !Array.isArray(data.groups)) return null;
  return data.groups.map(parseGroup).filter((group): group is CommunityGroup => group !== null);
}

export function groupsFor(groups: CommunityGroup[], locale: CommunityLocale) {
  return groups.filter((group) => !group.locales || group.locales.includes(locale));
}

export function isExpired(group: CommunityGroup, now = new Date()) {
  if (!group.expiresAt) return false;
  const [year, month, day] = group.expiresAt.split("-").map(Number);
  return now.getTime() >= new Date(year, month - 1, day + 1).getTime();
}

type Fetcher = (url: string, init: { signal: AbortSignal; cache: RequestCache }) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

export async function loadCommunityList(fetcher: Fetcher, timeoutMs = COMMUNITY_TIMEOUT_MS): Promise<CommunityList | null> {
  for (const source of COMMUNITY_SOURCES) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(communityUrl(source, "community.json"), { signal: controller.signal, cache: "no-cache" });
      if (!response.ok) continue;
      const groups = parseCommunityList(await response.json());
      if (groups) return { groups, source };
    } catch {
      continue;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}
