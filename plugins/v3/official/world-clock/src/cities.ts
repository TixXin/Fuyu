export type CityEntry = {
  zh: string;
  en: string;
  code: string;
  timeZone: string;
};

export type SearchResult = CityEntry & { kind: "city" | "zone" };

const RAW: readonly [string, string, string, string][] = [
  ["上海", "Shanghai", "SHA", "Asia/Shanghai"],
  ["北京", "Beijing", "PEK", "Asia/Shanghai"],
  ["深圳", "Shenzhen", "SZX", "Asia/Shanghai"],
  ["广州", "Guangzhou", "CAN", "Asia/Shanghai"],
  ["成都", "Chengdu", "CTU", "Asia/Shanghai"],
  ["香港", "Hong Kong", "HKG", "Asia/Hong_Kong"],
  ["澳门", "Macau", "MFM", "Asia/Macau"],
  ["台北", "Taipei", "TPE", "Asia/Taipei"],
  ["东京", "Tokyo", "TYO", "Asia/Tokyo"],
  ["大阪", "Osaka", "OSA", "Asia/Tokyo"],
  ["首尔", "Seoul", "SEL", "Asia/Seoul"],
  ["乌兰巴托", "Ulaanbaatar", "ULN", "Asia/Ulaanbaatar"],
  ["新加坡", "Singapore", "SIN", "Asia/Singapore"],
  ["吉隆坡", "Kuala Lumpur", "KUL", "Asia/Kuala_Lumpur"],
  ["曼谷", "Bangkok", "BKK", "Asia/Bangkok"],
  ["河内", "Hanoi", "HAN", "Asia/Bangkok"],
  ["胡志明市", "Ho Chi Minh City", "SGN", "Asia/Ho_Chi_Minh"],
  ["雅加达", "Jakarta", "JKT", "Asia/Jakarta"],
  ["马尼拉", "Manila", "MNL", "Asia/Manila"],
  ["仰光", "Yangon", "RGN", "Asia/Yangon"],
  ["达卡", "Dhaka", "DAC", "Asia/Dhaka"],
  ["加德满都", "Kathmandu", "KTM", "Asia/Kathmandu"],
  ["新德里", "New Delhi", "DEL", "Asia/Kolkata"],
  ["孟买", "Mumbai", "BOM", "Asia/Kolkata"],
  ["班加罗尔", "Bangalore", "BLR", "Asia/Kolkata"],
  ["科伦坡", "Colombo", "CMB", "Asia/Colombo"],
  ["卡拉奇", "Karachi", "KHI", "Asia/Karachi"],
  ["塔什干", "Tashkent", "TAS", "Asia/Tashkent"],
  ["阿拉木图", "Almaty", "ALA", "Asia/Almaty"],
  ["喀布尔", "Kabul", "KBL", "Asia/Kabul"],
  ["迪拜", "Dubai", "DXB", "Asia/Dubai"],
  ["阿布扎比", "Abu Dhabi", "AUH", "Asia/Dubai"],
  ["多哈", "Doha", "DOH", "Asia/Qatar"],
  ["利雅得", "Riyadh", "RUH", "Asia/Riyadh"],
  ["德黑兰", "Tehran", "THR", "Asia/Tehran"],
  ["巴格达", "Baghdad", "BGW", "Asia/Baghdad"],
  ["耶路撒冷", "Jerusalem", "JRS", "Asia/Jerusalem"],
  ["特拉维夫", "Tel Aviv", "TLV", "Asia/Jerusalem"],
  ["伊斯坦布尔", "Istanbul", "IST", "Europe/Istanbul"],
  ["莫斯科", "Moscow", "MOW", "Europe/Moscow"],
  ["基辅", "Kyiv", "IEV", "Europe/Kiev"],
  ["雅典", "Athens", "ATH", "Europe/Athens"],
  ["赫尔辛基", "Helsinki", "HEL", "Europe/Helsinki"],
  ["华沙", "Warsaw", "WAW", "Europe/Warsaw"],
  ["布拉格", "Prague", "PRG", "Europe/Prague"],
  ["维也纳", "Vienna", "VIE", "Europe/Vienna"],
  ["柏林", "Berlin", "BER", "Europe/Berlin"],
  ["法兰克福", "Frankfurt", "FRA", "Europe/Berlin"],
  ["慕尼黑", "Munich", "MUC", "Europe/Berlin"],
  ["苏黎世", "Zurich", "ZRH", "Europe/Zurich"],
  ["巴黎", "Paris", "PAR", "Europe/Paris"],
  ["布鲁塞尔", "Brussels", "BRU", "Europe/Brussels"],
  ["阿姆斯特丹", "Amsterdam", "AMS", "Europe/Amsterdam"],
  ["哥本哈根", "Copenhagen", "CPH", "Europe/Copenhagen"],
  ["斯德哥尔摩", "Stockholm", "STO", "Europe/Stockholm"],
  ["奥斯陆", "Oslo", "OSL", "Europe/Oslo"],
  ["罗马", "Rome", "ROM", "Europe/Rome"],
  ["米兰", "Milan", "MIL", "Europe/Rome"],
  ["马德里", "Madrid", "MAD", "Europe/Madrid"],
  ["巴塞罗那", "Barcelona", "BCN", "Europe/Madrid"],
  ["里斯本", "Lisbon", "LIS", "Europe/Lisbon"],
  ["伦敦", "London", "LON", "Europe/London"],
  ["都柏林", "Dublin", "DUB", "Europe/Dublin"],
  ["雷克雅未克", "Reykjavik", "REK", "Atlantic/Reykjavik"],
  ["开罗", "Cairo", "CAI", "Africa/Cairo"],
  ["约翰内斯堡", "Johannesburg", "JNB", "Africa/Johannesburg"],
  ["开普敦", "Cape Town", "CPT", "Africa/Johannesburg"],
  ["内罗毕", "Nairobi", "NBO", "Africa/Nairobi"],
  ["拉各斯", "Lagos", "LOS", "Africa/Lagos"],
  ["卡萨布兰卡", "Casablanca", "CAS", "Africa/Casablanca"],
  ["纽约", "New York", "NYC", "America/New_York"],
  ["华盛顿", "Washington", "WAS", "America/New_York"],
  ["波士顿", "Boston", "BOS", "America/New_York"],
  ["多伦多", "Toronto", "YTO", "America/Toronto"],
  ["芝加哥", "Chicago", "CHI", "America/Chicago"],
  ["休斯敦", "Houston", "HOU", "America/Chicago"],
  ["墨西哥城", "Mexico City", "MEX", "America/Mexico_City"],
  ["丹佛", "Denver", "DEN", "America/Denver"],
  ["凤凰城", "Phoenix", "PHX", "America/Phoenix"],
  ["洛杉矶", "Los Angeles", "LAX", "America/Los_Angeles"],
  ["旧金山", "San Francisco", "SFO", "America/Los_Angeles"],
  ["西雅图", "Seattle", "SEA", "America/Los_Angeles"],
  ["温哥华", "Vancouver", "YVR", "America/Vancouver"],
  ["安克雷奇", "Anchorage", "ANC", "America/Anchorage"],
  ["檀香山", "Honolulu", "HNL", "Pacific/Honolulu"],
  ["圣保罗", "São Paulo", "SAO", "America/Sao_Paulo"],
  ["里约热内卢", "Rio de Janeiro", "RIO", "America/Sao_Paulo"],
  ["布宜诺斯艾利斯", "Buenos Aires", "BUE", "America/Argentina/Buenos_Aires"],
  ["圣地亚哥", "Santiago", "SCL", "America/Santiago"],
  ["利马", "Lima", "LIM", "America/Lima"],
  ["波哥大", "Bogotá", "BOG", "America/Bogota"],
  ["悉尼", "Sydney", "SYD", "Australia/Sydney"],
  ["墨尔本", "Melbourne", "MEL", "Australia/Melbourne"],
  ["布里斯班", "Brisbane", "BNE", "Australia/Brisbane"],
  ["阿德莱德", "Adelaide", "ADL", "Australia/Adelaide"],
  ["珀斯", "Perth", "PER", "Australia/Perth"],
  ["奥克兰", "Auckland", "AKL", "Pacific/Auckland"],
  ["协调世界时", "UTC", "UTC", "UTC"],
];

export const CITIES: readonly CityEntry[] = RAW.map(([zh, en, code, timeZone]) => ({ zh, en, code, timeZone }));

export function findCityByZone(timeZone: string): CityEntry | undefined {
  return CITIES.find((city) => city.timeZone === timeZone);
}

function systemZones(): string[] {
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
    return intl.supportedValuesOf?.("timeZone") ?? [];
  } catch {
    return [];
  }
}

function fold(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[\s_/-]+/g, "");
}

function zoneEntry(timeZone: string): CityEntry {
  const tail = (timeZone.split("/").pop() ?? timeZone).replace(/_/g, " ");
  return { zh: tail, en: tail, code: tail.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "CLK", timeZone };
}

export function searchCities(query: string, limit = 30, zones: readonly string[] = systemZones()): SearchResult[] {
  const q = fold(query.trim());
  if (!q) return CITIES.slice(0, limit).map((city) => ({ ...city, kind: "city" }));
  const scored: { item: SearchResult; score: number }[] = [];
  for (const city of CITIES) {
    const keys = [fold(city.zh), fold(city.en), city.code.toLowerCase(), fold(city.timeZone)];
    const score = keys.some((key) => key.startsWith(q)) ? 0 : keys.some((key) => key.includes(q)) ? 1 : -1;
    if (score >= 0) scored.push({ item: { ...city, kind: "city" }, score });
  }
  const cityZones = new Set(scored.map((entry) => entry.item.timeZone));
  for (const zone of zones) {
    if (cityZones.has(zone) || findCityByZone(zone)) continue;
    const key = fold(zone);
    if (key.includes(q)) scored.push({ item: { ...zoneEntry(zone), kind: "zone" }, score: 2 });
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, limit).map((entry) => entry.item);
}
