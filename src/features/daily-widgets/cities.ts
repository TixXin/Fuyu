export const CITIES = {
  beijing: { zone: "Asia/Shanghai", lat: 39.9, lon: 116.4 },
  shanghai: { zone: "Asia/Shanghai", lat: 31.23, lon: 121.47 },
  guangzhou: { zone: "Asia/Shanghai", lat: 23.13, lon: 113.26 },
  shenzhen: { zone: "Asia/Shanghai", lat: 22.54, lon: 114.06 },
  hangzhou: { zone: "Asia/Shanghai", lat: 30.27, lon: 120.16 },
  nanjing: { zone: "Asia/Shanghai", lat: 32.06, lon: 118.8 },
  wuhan: { zone: "Asia/Shanghai", lat: 30.59, lon: 114.31 },
  chengdu: { zone: "Asia/Shanghai", lat: 30.57, lon: 104.07 },
  chongqing: { zone: "Asia/Shanghai", lat: 29.56, lon: 106.55 },
  xian: { zone: "Asia/Shanghai", lat: 34.34, lon: 108.94 },
  harbin: { zone: "Asia/Shanghai", lat: 45.8, lon: 126.53 },
  kunming: { zone: "Asia/Shanghai", lat: 25.04, lon: 102.71 },
  urumqi: { zone: "Asia/Shanghai", lat: 43.83, lon: 87.62 },
  hongKong: { zone: "Asia/Hong_Kong", lat: 22.32, lon: 114.17 },
  taipei: { zone: "Asia/Taipei", lat: 25.03, lon: 121.57 },
  tokyo: { zone: "Asia/Tokyo", lat: 35.68, lon: 139.69 },
  seoul: { zone: "Asia/Seoul", lat: 37.57, lon: 126.98 },
  singapore: { zone: "Asia/Singapore", lat: 1.35, lon: 103.82 },
  bangkok: { zone: "Asia/Bangkok", lat: 13.76, lon: 100.5 },
  delhi: { zone: "Asia/Kolkata", lat: 28.61, lon: 77.21 },
  dubai: { zone: "Asia/Dubai", lat: 25.2, lon: 55.27 },
  moscow: { zone: "Europe/Moscow", lat: 55.76, lon: 37.62 },
  istanbul: { zone: "Europe/Istanbul", lat: 41.01, lon: 28.98 },
  berlin: { zone: "Europe/Berlin", lat: 52.52, lon: 13.4 },
  paris: { zone: "Europe/Paris", lat: 48.86, lon: 2.35 },
  london: { zone: "Europe/London", lat: 51.51, lon: -0.13 },
  newYork: { zone: "America/New_York", lat: 40.71, lon: -74.01 },
  toronto: { zone: "America/Toronto", lat: 43.65, lon: -79.38 },
  chicago: { zone: "America/Chicago", lat: 41.88, lon: -87.63 },
  losAngeles: { zone: "America/Los_Angeles", lat: 34.05, lon: -118.24 },
  vancouver: { zone: "America/Vancouver", lat: 49.28, lon: -123.12 },
  saoPaulo: { zone: "America/Sao_Paulo", lat: -23.55, lon: -46.63 },
  sydney: { zone: "Australia/Sydney", lat: -33.87, lon: 151.21 },
  melbourne: { zone: "Australia/Melbourne", lat: -37.81, lon: 144.96 },
  auckland: { zone: "Pacific/Auckland", lat: -36.85, lon: 174.76 },
} as const;

export type CityId = keyof typeof CITIES;

export const CITY_IDS = Object.keys(CITIES) as CityId[];

export const DEFAULT_WORLD_CITIES: readonly CityId[] = ["tokyo", "london", "newYork"];

const ZONE_ALIASES: Readonly<Record<string, CityId>> = {
  "Asia/Shanghai": "shanghai",
  "Asia/Chongqing": "chongqing",
  "Asia/Chungking": "chongqing",
  "Asia/Harbin": "harbin",
  "Asia/Urumqi": "urumqi",
  "Asia/Kashgar": "urumqi",
  "Asia/Macau": "hongKong",
  "Asia/Calcutta": "delhi",
  "US/Eastern": "newYork",
  "US/Pacific": "losAngeles",
  "US/Central": "chicago",
  PRC: "shanghai",
  Japan: "tokyo",
};

export const isCityId = (value: unknown): value is CityId => typeof value === "string" && Object.prototype.hasOwnProperty.call(CITIES, value);

export function cityForZone(zone: string | undefined): CityId | null {
  if (!zone) return null;
  const alias = ZONE_ALIASES[zone];
  if (alias) return alias;
  return CITY_IDS.find((id) => CITIES[id].zone === zone) ?? null;
}

export function systemZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}
