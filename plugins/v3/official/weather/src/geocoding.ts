import type { HttpFetch } from "@fuyu/plugin-base";
import { coordsId } from "./config.ts";
import { REQUEST_TIMEOUT_MS, geocodeLanguage } from "./openMeteo.ts";
import type { WeatherPlace } from "./types.ts";

const USER_AGENT = "FuyuWeather/1.4 (fuyu-desktop)";

interface GeoResult {
  name?: string;
  admin1?: string;
  admin2?: string;
  country?: string;
  country_code?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    city?: string;
    county?: string;
    district?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    osm_key?: string;
    osm_value?: string;
  };
}

const defaultFetch: HttpFetch = (input, init) => fetch(input, init);

function timeoutSignal(): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  }
  return undefined;
}

async function fetchJson<T>(url: URL, fetcher: HttpFetch, headers: Record<string, string> = {}): Promise<T> {
  const signal = timeoutSignal();
  const init: Record<string, unknown> = {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT, ...headers },
  };
  if (signal) init.signal = signal;
  const response = await fetcher(url, init);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as T;
}

function toOpenMeteoPlace(candidate: GeoResult, fallbackName: string): WeatherPlace | null {
  if (typeof candidate.latitude !== "number" || typeof candidate.longitude !== "number") return null;
  return {
    id: coordsId(candidate.latitude, candidate.longitude),
    name: String(candidate.name ?? fallbackName),
    region: String(candidate.admin1 ?? ""),
    country: String(candidate.country ?? ""),
    countryCode: typeof candidate.country_code === "string" ? candidate.country_code.toUpperCase() : undefined,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    timezone: typeof candidate.timezone === "string" ? candidate.timezone : undefined,
  };
}

function toPhotonPlace(feature: PhotonFeature, fallbackName: string): WeatherPlace | null {
  const coords = feature.geometry?.coordinates;
  if (!Array.isArray(coords) || typeof coords[0] !== "number" || typeof coords[1] !== "number") return null;
  const [longitude, latitude] = coords;
  const props = feature.properties ?? {};
  const name = String(props.name ?? props.city ?? props.county ?? fallbackName).trim();
  if (!name) return null;
  const region = String(props.state ?? props.county ?? props.city ?? "").trim();
  const country = String(props.country ?? "").trim();
  const countryCode = typeof props.countrycode === "string" ? props.countrycode.toUpperCase() : undefined;
  return {
    id: coordsId(latitude, longitude),
    name,
    region: region === name ? "" : region,
    country,
    countryCode,
    latitude,
    longitude,
  };
}

async function searchOpenMeteo(queryName: string, fetcher: HttpFetch): Promise<WeatherPlace[]> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("count", "10");
  url.searchParams.set("format", "json");
  url.searchParams.set("language", geocodeLanguage(queryName));
  url.searchParams.set("name", queryName);
  const data = await fetchJson<{ results?: GeoResult[] }>(url, fetcher);
  const results = Array.isArray(data.results) ? data.results.filter(Boolean) : [];
  return results.map((item) => toOpenMeteoPlace(item, queryName)).filter((item): item is WeatherPlace => item !== null);
}

async function searchPhoton(fullQuery: string, queryName: string, fetcher: HttpFetch): Promise<WeatherPlace[]> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", fullQuery);
  url.searchParams.set("limit", "10");
  const data = await fetchJson<{ features?: PhotonFeature[] }>(url, fetcher);
  const features = Array.isArray(data.features) ? data.features.filter(Boolean) : [];
  const placeLike = features.filter((item) => {
    const key = item.properties?.osm_key;
    const val = item.properties?.osm_value;
    if (!key) return true;
    return key === "place" || key === "boundary" || val === "administrative" || val === "city" || val === "town" || val === "county";
  });
  const picked = placeLike.length > 0 ? placeLike : features;
  return picked.map((item) => toPhotonPlace(item, queryName)).filter((item): item is WeatherPlace => item !== null);
}

function nearSamePlace(a: WeatherPlace, b: WeatherPlace): boolean {
  const latDiff = Math.abs(a.latitude - b.latitude);
  const lonDiff = Math.abs(a.longitude - b.longitude);
  if (latDiff < 0.01 && lonDiff < 0.01) return true;
  if (latDiff < 0.25 && lonDiff < 0.25 && a.region && b.region && a.region.slice(0, 2) === b.region.slice(0, 2)) {
    const na = a.name.replace(/[市县区省]$/, "");
    const nb = b.name.replace(/[市县区省]$/, "");
    if (na === nb) return true;
  }
  return false;
}

function scorePlace(place: WeatherPlace, queryName: string, hint: string): number {
  let score = 0;
  const qLower = queryName.toLowerCase();
  const nLower = place.name.toLowerCase();
  const stripped = place.name.replace(/[市县区省]$/, "").toLowerCase();
  if (nLower === qLower) score += 100;
  else if (stripped === qLower) score += 105;
  else if (nLower.startsWith(qLower)) score += 60;
  if (/[市县区]$/.test(place.name)) score += 15;
  if (/[村屯组]$/.test(place.name)) score -= 25;
  if (place.region) score += 10;
  if (hint) {
    const hay = [place.region, place.country, place.countryCode]
      .filter((item): item is string => typeof item === "string" && item.length > 0)
      .map((item) => item.toLowerCase());
    if (hay.some((item) => item.includes(hint))) score += 200;
  }
  return score;
}

export async function searchPlacesMulti(cityInput: string, fetcher: HttpFetch = defaultFetch): Promise<WeatherPlace[]> {
  const trimmed = cityInput.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(/[,，]/, 2);
  const queryName = parts[0].trim();
  if (!queryName) return [];
  const hint = parts.length > 1 ? parts[1].trim().toLowerCase() : "";

  const [omRes, photonRes] = await Promise.allSettled([
    searchOpenMeteo(queryName, fetcher),
    searchPhoton(trimmed, queryName, fetcher),
  ]);

  const combined: WeatherPlace[] = [];
  const isZh = geocodeLanguage(queryName) === "zh";
  const first = isZh ? photonRes : omRes;
  const second = isZh ? omRes : photonRes;

  if (first.status === "fulfilled") combined.push(...first.value);
  if (second.status === "fulfilled") combined.push(...second.value);

  if (combined.length === 0) {
    if (omRes.status === "rejected" && photonRes.status === "rejected") {
      throw omRes.reason;
    }
    return [];
  }

  const ranked = combined
    .map((place, index) => ({ place, score: scorePlace(place, queryName, hint), index }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const unique: WeatherPlace[] = [];
  for (const { place } of ranked) {
    const dup = unique.find((existing) => nearSamePlace(existing, place));
    if (dup) {
      if (!dup.timezone && place.timezone) dup.timezone = place.timezone;
      if (!dup.countryCode && place.countryCode) dup.countryCode = place.countryCode;
      continue;
    }
    unique.push(place);
    if (unique.length >= 8) break;
  }
  return unique;
}
