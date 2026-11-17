export type Locale = "zh-CN" | "en";
export type TemperatureUnit = "celsius" | "fahrenheit";

export interface WeatherConfig {
  city: string;
  units: TemperatureUnit;
  showOnBar: boolean;
  rainAlert: boolean;
  refreshMinutes: number;
  locale: Locale;
}

export interface WeatherPlace {
  name: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
}

export interface WeatherCurrent {
  temp: number;
  feels: number;
  humidity: number;
  wind: number;
  code: number;
  day: number;
  mm: number;
}

export interface WeatherHour {
  time: string;
  temp: number;
  pop: number;
  code: number;
  day: number;
}

export interface WeatherDay {
  date: string;
  code: number;
  max: number;
  min: number;
  pop: number;
}

export interface WeatherSoon {
  time: string;
  mm: number;
}

export interface WeatherForecast {
  now: string;
  current: WeatherCurrent;
  hourly: WeatherHour[];
  daily: WeatherDay[];
  soon: WeatherSoon[];
}

export interface WeatherState {
  config: WeatherConfig;
  place: WeatherPlace | null;
  forecast: WeatherForecast | null;
  fetchedAt: number | null;
  loading: boolean;
  problem: string | null;
  updatedAt: number;
}

export const DEFAULT_CONFIG: WeatherConfig = {
  city: "",
  units: "celsius",
  showOnBar: true,
  rainAlert: true,
  refreshMinutes: 30,
  locale: "zh-CN",
};

export const METHODS = {
  getState: "getState",
  setConfig: "setConfig",
  refresh: "refresh",
} as const;

export const TOPICS = {
  state: "state",
} as const;

export function detectLocale(): Locale {
  if (typeof navigator !== "undefined" && /^zh\b/i.test(navigator.language)) {
    return "zh-CN";
  }
  return "en";
}

export function formatTemp(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${Math.round(value)}°`;
}

const CODES: Record<number, { "zh-CN": [string, string]; en: [string, string] }> = {
  0: { "zh-CN": ["晴", "晴"], en: ["Clear", "Clear"] },
  1: { "zh-CN": ["晴", "晴间少云"], en: ["Clear", "Mainly clear"] },
  2: { "zh-CN": ["多云", "多云"], en: ["Cloudy", "Partly cloudy"] },
  3: { "zh-CN": ["阴", "阴"], en: ["Cloudy", "Overcast"] },
  45: { "zh-CN": ["雾", "雾"], en: ["Fog", "Fog"] },
  48: { "zh-CN": ["雾凇", "雾凇"], en: ["Fog", "Freezing fog"] },
  51: { "zh-CN": ["毛毛雨", "小毛毛雨"], en: ["Drizzle", "Light drizzle"] },
  53: { "zh-CN": ["毛毛雨", "毛毛雨"], en: ["Drizzle", "Drizzle"] },
  55: { "zh-CN": ["毛毛雨", "较强毛毛雨"], en: ["Drizzle", "Dense drizzle"] },
  56: { "zh-CN": ["冻雨", "冻毛毛雨"], en: ["Ice", "Freezing drizzle"] },
  57: { "zh-CN": ["冻雨", "强冻毛毛雨"], en: ["Ice", "Heavy freezing drizzle"] },
  61: { "zh-CN": ["小雨", "小雨"], en: ["Rain", "Light rain"] },
  63: { "zh-CN": ["中雨", "中雨"], en: ["Rain", "Rain"] },
  65: { "zh-CN": ["大雨", "大雨"], en: ["Rain", "Heavy rain"] },
  66: { "zh-CN": ["冻雨", "冻雨"], en: ["Ice", "Freezing rain"] },
  67: { "zh-CN": ["冻雨", "强冻雨"], en: ["Ice", "Heavy freezing rain"] },
  71: { "zh-CN": ["小雪", "小雪"], en: ["Snow", "Light snow"] },
  73: { "zh-CN": ["中雪", "中雪"], en: ["Snow", "Snow"] },
  75: { "zh-CN": ["大雪", "大雪"], en: ["Snow", "Heavy snow"] },
  77: { "zh-CN": ["米雪", "米雪"], en: ["Snow", "Snow grains"] },
  80: { "zh-CN": ["阵雨", "小阵雨"], en: ["Shower", "Light showers"] },
  81: { "zh-CN": ["阵雨", "阵雨"], en: ["Shower", "Showers"] },
  82: { "zh-CN": ["强阵雨", "强阵雨"], en: ["Shower", "Heavy showers"] },
  85: { "zh-CN": ["阵雪", "小阵雪"], en: ["Snow", "Snow showers"] },
  86: { "zh-CN": ["阵雪", "强阵雪"], en: ["Snow", "Heavy snow showers"] },
  95: { "zh-CN": ["雷阵雨", "雷阵雨"], en: ["Storm", "Thunderstorm"] },
  96: { "zh-CN": ["雷雨", "雷雨伴冰雹"], en: ["Storm", "Thunderstorm, hail"] },
  99: { "zh-CN": ["雷雨", "强雷雨伴冰雹"], en: ["Storm", "Severe thunderstorm"] },
};

export function conditionLabel(code: number, locale: Locale, short = false): string {
  const entry = CODES[code];
  if (!entry) return locale === "zh-CN" ? "未知" : "Unknown";
  return entry[locale][short ? 0 : 1];
}

export const TEXT = {
  "zh-CN": {
    title: "天气",
    cityLabel: "城市",
    cityPlaceholder: "如：杭州 或 London, UK（留空不联网）",
    unitsLabel: "温度单位",
    celsius: "摄氏度 °C",
    fahrenheit: "华氏度 °F",
    showOnBar: "在收起条显示天气与温度",
    rainAlert: "一小时内即将下雨时提醒",
    refreshMinutes: "刷新间隔（分钟）",
    save: "保存设置",
    refresh: "立即刷新",
    emptyTitle: "尚未设置城市",
    emptyBody: "请在设置分节填写城市名；填写前插件不会发起任何网络请求。",
    loading: "正在获取天气…",
    feels: "体感",
    humidity: "湿度",
    wind: "风速",
    hourly: "未来数小时",
    daily: "未来 7 天",
    today: "今天",
    noPlace: (city: string) => `未找到「${city}」，可尝试加上省/州或国家名称`,
    offline: (err: string) => `天气请求失败：${err}`,
    rainTitle: "快要下雨了",
    rainBody: (place: string, time: string) => `${place} 预计 ${time} 前后开始下雨，记得带伞`,
    sourceNote: "数据来源：Open-Meteo",
  },
  en: {
    title: "Weather",
    cityLabel: "City",
    cityPlaceholder: "e.g. Hangzhou or London, UK (offline when empty)",
    unitsLabel: "Temperature unit",
    celsius: "Celsius °C",
    fahrenheit: "Fahrenheit °F",
    showOnBar: "Show weather and temperature on collapsed bar",
    rainAlert: "Alert on the island when rain is due within 1 hour",
    refreshMinutes: "Refresh interval (minutes)",
    save: "Save settings",
    refresh: "Refresh now",
    emptyTitle: "No city configured",
    emptyBody: "Set a city name in Settings; the plugin makes no network requests while empty.",
    loading: "Fetching weather…",
    feels: "Feels",
    humidity: "Humidity",
    wind: "Wind",
    hourly: "Upcoming hours",
    daily: "Next 7 days",
    today: "Today",
    noPlace: (city: string) => `Could not find "${city}". Try adding state or country.`,
    offline: (err: string) => `Weather request failed: ${err}`,
    rainTitle: "Rain on the way",
    rainBody: (place: string, time: string) => `Rain expected in ${place} around ${time}; bring an umbrella`,
    sourceNote: "Data: Open-Meteo",
  },
} as const;
