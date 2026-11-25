type LocalizedFestival = { zh: string; en: string };

const FIXED_WORLD_FESTIVALS: Record<string, LocalizedFestival> = {
  "2-2": { zh: "世界湿地日", en: "Wetlands Day" },
  "3-14": { zh: "白色情人节", en: "White Day" },
  "3-15": { zh: "消费者日", en: "Consumer Day" },
  "3-21": { zh: "世界睡眠日", en: "Sleep Day" },
  "3-22": { zh: "世界水日", en: "Water Day" },
  "3-23": { zh: "世界气象日", en: "Met. Day" },
  "4-7": { zh: "世界卫生日", en: "Health Day" },
  "4-22": { zh: "地球日", en: "Earth Day" },
  "4-23": { zh: "世界读书日", en: "Book Day" },
  "5-8": { zh: "红十字日", en: "Red Cross Day" },
  "5-15": { zh: "国际家庭日", en: "Family Day" },
  "5-18": { zh: "博物馆日", en: "Museum Day" },
  "5-31": { zh: "世界无烟日", en: "No Tobacco" },
  "6-5": { zh: "世界环境日", en: "Environment" },
  "6-8": { zh: "世界海洋日", en: "Oceans Day" },
  "6-26": { zh: "国际禁毒日", en: "Anti-Drug" },
  "7-11": { zh: "世界人口日", en: "Population" },
  "8-12": { zh: "国际青年日", en: "Youth Day" },
  "9-21": { zh: "国际和平日", en: "Peace Day" },
  "10-4": { zh: "世界动物日", en: "Animal Day" },
  "10-16": { zh: "世界粮食日", en: "Food Day" },
  "10-24": { zh: "联合国日", en: "UN Day" },
  "10-31": { zh: "万圣夜", en: "Halloween" },
  "11-1": { zh: "万圣节", en: "All Saints" },
  "12-1": { zh: "艾滋病日", en: "AIDS Day" },
  "12-3": { zh: "残疾人日", en: "Disability Day" },
  "12-10": { zh: "世界人权日", en: "Human Rights" },
  "12-20": { zh: "澳门回归", en: "Macao Day" },
};

const EN_CORE_FESTIVALS: Record<string, string> = {
  "1-1": "New Year",
  "2-14": "Valentine's",
  "3-8": "Women's Day",
  "4-1": "April Fools'",
  "5-1": "Labour Day",
  "6-1": "Children's",
  "12-24": "Xmas Eve",
  "12-25": "Christmas",
};

export function easterDate(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

function floatingWorldFestival(date: Date, isZh: boolean): string | null {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const easter = easterDate(year);
  if (month === easter.month && day === easter.day) return isZh ? "复活节" : "Easter";
  const nth = Math.ceil(day / 7);
  const weekday = date.getDay();
  if (month === 11 && nth === 4 && weekday === 4) return isZh ? "感恩节" : "Thanksgiving";
  if (!isZh) {
    if (month === 5 && nth === 2 && weekday === 0) return "Mother's Day";
    if (month === 6 && nth === 3 && weekday === 0) return "Father's Day";
  }
  return null;
}

export function internationalFestival(date: Date, locale: string = "zh-CN"): string | null {
  const isZh = locale === "zh-CN";
  const key = `${date.getMonth() + 1}-${date.getDate()}`;
  const fixed = FIXED_WORLD_FESTIVALS[key];
  if (fixed) return isZh ? fixed.zh : fixed.en;
  if (!isZh && EN_CORE_FESTIVALS[key]) return EN_CORE_FESTIVALS[key];
  return floatingWorldFestival(date, isZh);
}
