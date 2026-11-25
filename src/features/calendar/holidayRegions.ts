import type { CalendarSource } from "./api";

export const ICLOUD_HOLIDAYS_HOST = "calendars.icloud.com";

export const HOLIDAY_REGIONS = [
  { id: "cn", code: "cn_zh" },
  { id: "hk", code: "hk_zh" },
  { id: "tw", code: "tw_zh" },
  { id: "mo", code: "mo_zh" },
  { id: "us", code: "us_en" },
  { id: "gb", code: "gb_en" },
  { id: "jp", code: "jp_ja" },
  { id: "kr", code: "kr_ko" },
  { id: "sg", code: "sg_en" },
  { id: "ca", code: "ca_en" },
  { id: "au", code: "au_en" },
  { id: "de", code: "de_de" },
  { id: "fr", code: "fr_fr" },
] as const;

export type HolidayRegionId = (typeof HOLIDAY_REGIONS)[number]["id"];

const KNOWN_REGION_NAMES: Record<HolidayRegionId, readonly string[]> = {
  cn: ["中国节假日", "中国大陆节假日", "china holidays", "china mainland holidays"],
  hk: ["中国香港节假日", "香港节假日", "hong kong holidays"],
  tw: ["中国台湾节假日", "台湾节假日", "taiwan holidays"],
  mo: ["中国澳门节假日", "澳门节假日", "macao holidays", "macau holidays"],
  us: ["美国节假日", "us holidays", "united states holidays"],
  gb: ["英国节假日", "uk holidays", "united kingdom holidays"],
  jp: ["日本节假日", "japan holidays"],
  kr: ["韩国节假日", "south korea holidays", "korea holidays"],
  sg: ["新加坡节假日", "singapore holidays"],
  ca: ["加拿大节假日", "canada holidays"],
  au: ["澳大利亚节假日", "australia holidays"],
  de: ["德国节假日", "germany holidays"],
  fr: ["法国节假日", "france holidays"],
};

const ALL_OTHER_REGION_NAMES = new Set(
  HOLIDAY_REGIONS.filter((item) => item.id !== "cn").flatMap((item) => KNOWN_REGION_NAMES[item.id].map((name) => name.toLowerCase())),
);

export function holidayLinkFor(region: HolidayRegionId): string {
  const entry = HOLIDAY_REGIONS.find((item) => item.id === region) ?? HOLIDAY_REGIONS[0];
  return `https://${ICLOUD_HOLIDAYS_HOST}/holidays/${entry.code}.ics`;
}

export function hasHolidayRegion(
  sources: readonly Pick<CalendarSource, "kind" | "host" | "name">[],
  region: HolidayRegionId,
  extraNames: readonly string[] = [],
): boolean {
  const names = new Set([...KNOWN_REGION_NAMES[region], ...extraNames].map((name) => name.trim().toLowerCase()).filter(Boolean));
  return sources.some((source) => {
    if (source.kind !== "ics" || source.host !== ICLOUD_HOLIDAYS_HOST) return false;
    const normalized = source.name.trim().toLowerCase();
    if (names.has(normalized)) return true;
    return region === "cn" && !ALL_OTHER_REGION_NAMES.has(normalized);
  });
}

export function hasChinaHolidays(sources: readonly Pick<CalendarSource, "kind" | "host" | "name">[]): boolean {
  return hasHolidayRegion(sources, "cn");
}
