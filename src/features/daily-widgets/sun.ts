const RADIANS = Math.PI / 180;
const DEFAULT_LATITUDE = 31;

export type SunDay = { rise: number; set: number };

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - start.getTime()) / 86_400_000);
}

export function guessedLongitude(date: Date): number {
  return (-date.getTimezoneOffset() / 60) * 15;
}

export function sunDay(date: Date, latitude = DEFAULT_LATITUDE, longitude = guessedLongitude(date)): SunDay {
  const day = dayOfYear(date);
  const declination = 23.44 * Math.sin(((2 * Math.PI) / 365) * (day - 81));
  const angle = (2 * Math.PI * (day - 81)) / 364;
  const equation = 9.87 * Math.sin(2 * angle) - 7.53 * Math.cos(angle) - 1.5 * Math.sin(angle);
  const noon = 720 - 4 * longitude - equation - date.getTimezoneOffset();
  const cosHour = (Math.sin(-0.833 * RADIANS) - Math.sin(latitude * RADIANS) * Math.sin(declination * RADIANS)) / (Math.cos(latitude * RADIANS) * Math.cos(declination * RADIANS));
  const hour = Math.acos(Math.min(1, Math.max(-1, cosHour))) / RADIANS;
  return { rise: noon - hour * 4, set: noon + hour * 4 };
}

export function minutesText(minutes: number): string {
  const whole = Math.round(minutes);
  const hours = Math.floor(whole / 60) % 24;
  return `${String(hours).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
}
