import { CITIES, cityForZone, type CityId } from "./cities.ts";

const RADIANS = Math.PI / 180;
const DEFAULT_LATITUDE = 31;

export type SunDay = { rise: number; set: number };
export type SunPlace = { city: CityId | null; zone: string | undefined; latitude: number; longitude: number | null };
export type ZonedClock = { year: number; month: number; day: number; minute: number; offset: number };

export function sunPlace(chosen: CityId | null, systemZone: string | undefined): SunPlace {
  const city = chosen ?? cityForZone(systemZone);
  if (!city) return { city: null, zone: undefined, latitude: DEFAULT_LATITUDE, longitude: null };
  const { zone, lat, lon } = CITIES[city];
  return { city, zone: chosen ? zone : undefined, latitude: lat, longitude: lon };
}

export function zonedClock(date: Date, zone?: string): ZonedClock {
  if (zone) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" }).formatToParts(date);
      const part = (type: string) => Number(parts.find((item) => item.type === type)?.value ?? NaN);
      const [year, month, day, hour, minute] = [part("year"), part("month"), part("day"), part("hour") % 24, part("minute")];
      if ([year, month, day, hour, minute].every(Number.isFinite)) {
        const offset = Math.round((Date.UTC(year, month - 1, day, hour, minute) - Math.floor(date.getTime() / 60_000) * 60_000) / 60_000);
        return { year, month, day, minute: hour * 60 + minute, offset };
      }
    } catch {
      return zonedClock(date);
    }
  }
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(), minute: date.getHours() * 60 + date.getMinutes(), offset: -date.getTimezoneOffset() };
}

function dayOfYear({ year, month, day }: ZonedClock): number {
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 0)) / 86_400_000);
}

export function sunDay(clock: ZonedClock, latitude = DEFAULT_LATITUDE, longitude = (clock.offset / 60) * 15): SunDay {
  const day = dayOfYear(clock);
  const declination = 23.44 * Math.sin(((2 * Math.PI) / 365) * (day - 81));
  const angle = (2 * Math.PI * (day - 81)) / 364;
  const equation = 9.87 * Math.sin(2 * angle) - 7.53 * Math.cos(angle) - 1.5 * Math.sin(angle);
  const noon = 720 - 4 * longitude - equation + clock.offset;
  const cosHour = (Math.sin(-0.833 * RADIANS) - Math.sin(latitude * RADIANS) * Math.sin(declination * RADIANS)) / (Math.cos(latitude * RADIANS) * Math.cos(declination * RADIANS));
  const hour = Math.acos(Math.min(1, Math.max(-1, cosHour))) / RADIANS;
  return { rise: noon - hour * 4, set: noon + hour * 4 };
}

export function minutesText(minutes: number): string {
  const whole = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(whole / 60);
  return `${String(hours).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
}
