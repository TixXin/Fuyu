const DAY_MS = 86_400_000;
const BRANCHES = "子丑寅卯辰巳午未申酉戌亥";
const DAY_NAMES = ["初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十", "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十", "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十"];
const SIGN_STARTS: [number, number][] = [
  [1, 20],
  [2, 19],
  [3, 21],
  [4, 20],
  [5, 21],
  [6, 22],
  [7, 23],
  [8, 23],
  [9, 23],
  [10, 24],
  [11, 23],
  [12, 22],
];

export interface Lunar {
  yearName: string;
  month: string;
  day: string;
  branch: number;
}

export function lunarOf(at: number): Lunar | null {
  try {
    const parts = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).formatToParts(new Date(at));
    const get = (type: string) => (parts as { type: string; value: string }[]).find((part) => part.type === type)?.value ?? "";
    const yearName = get("yearName");
    const branch = BRANCHES.indexOf(yearName.slice(1, 2));
    const dayNumber = Number(get("day"));
    if (branch < 0 || !get("month")) return null;
    return { yearName, month: get("month"), day: DAY_NAMES[dayNumber - 1] ?? get("day"), branch };
  } catch {
    return null;
  }
}

export function zodiacIndex(at: number): number {
  const lunar = lunarOf(at);
  if (lunar) return lunar.branch;
  return (((new Date(at).getUTCFullYear() - 4) % 12) + 12) % 12;
}

export function signIndex(at: number): number {
  const date = new Date(at);
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const start = SIGN_STARTS[month - 1];
  return day >= start[1] ? month - 1 : (month + 10) % 12;
}

function lunarYear(at: number): number {
  try {
    const parts = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", { year: "numeric", timeZone: "UTC" }).formatToParts(new Date(at));
    const year = Number((parts as { type: string; value: string }[]).find((part) => part.type === "relatedYear")?.value);
    if (year) return year;
  } catch {}
  return new Date(at).getUTCFullYear();
}

function birthdayIn(year: number, birth: Date): number {
  const lastDay = new Date(Date.UTC(year, birth.getUTCMonth() + 1, 0)).getUTCDate();
  return Date.UTC(year, birth.getUTCMonth(), Math.min(birth.getUTCDate(), lastDay));
}

export interface Age {
  years: number;
  nominal: number;
  daysLived: number;
  nextBirthday: number;
  daysToBirthday: number;
  zodiac: number;
  sign: number;
}

export function ageOf(birthAt: number, todayAt: number): Age | null {
  if (birthAt > todayAt) return null;
  const birth = new Date(birthAt);
  const today = new Date(todayAt);
  let years = today.getUTCFullYear() - birth.getUTCFullYear();
  if (birthdayIn(today.getUTCFullYear(), birth) > todayAt) years -= 1;
  let next = birthdayIn(today.getUTCFullYear(), birth);
  if (next < todayAt) next = birthdayIn(today.getUTCFullYear() + 1, birth);
  return {
    years,
    nominal: lunarYear(todayAt) - lunarYear(birthAt) + 1,
    daysLived: Math.round((todayAt - birthAt) / DAY_MS),
    nextBirthday: next,
    daysToBirthday: Math.round((next - todayAt) / DAY_MS),
    zodiac: zodiacIndex(birthAt),
    sign: signIndex(birthAt),
  };
}
