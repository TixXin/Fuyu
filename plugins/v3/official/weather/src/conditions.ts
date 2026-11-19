import type { Locale } from "./locale.ts";

export type ConditionKind = "clear" | "partly" | "cloudy" | "fog" | "rain" | "snow" | "storm";

type Entry = { kind: ConditionKind; "zh-CN": [string, string]; en: [string, string] };

const CODES: Record<number, Entry> = {
  0: { kind: "clear", "zh-CN": ["晴", "晴"], en: ["Clear", "Clear"] },
  1: { kind: "clear", "zh-CN": ["晴", "晴间少云"], en: ["Clear", "Mainly clear"] },
  2: { kind: "partly", "zh-CN": ["多云", "多云"], en: ["Cloudy", "Partly cloudy"] },
  3: { kind: "cloudy", "zh-CN": ["阴", "阴"], en: ["Cloudy", "Overcast"] },
  45: { kind: "fog", "zh-CN": ["雾", "雾"], en: ["Fog", "Fog"] },
  48: { kind: "fog", "zh-CN": ["雾凇", "雾凇"], en: ["Fog", "Freezing fog"] },
  51: { kind: "rain", "zh-CN": ["毛毛雨", "小毛毛雨"], en: ["Drizzle", "Light drizzle"] },
  53: { kind: "rain", "zh-CN": ["毛毛雨", "毛毛雨"], en: ["Drizzle", "Drizzle"] },
  55: { kind: "rain", "zh-CN": ["毛毛雨", "较强毛毛雨"], en: ["Drizzle", "Dense drizzle"] },
  56: { kind: "rain", "zh-CN": ["冻雨", "冻毛毛雨"], en: ["Ice", "Freezing drizzle"] },
  57: { kind: "rain", "zh-CN": ["冻雨", "强冻毛毛雨"], en: ["Ice", "Heavy freezing drizzle"] },
  61: { kind: "rain", "zh-CN": ["小雨", "小雨"], en: ["Rain", "Light rain"] },
  63: { kind: "rain", "zh-CN": ["中雨", "中雨"], en: ["Rain", "Rain"] },
  65: { kind: "rain", "zh-CN": ["大雨", "大雨"], en: ["Rain", "Heavy rain"] },
  66: { kind: "rain", "zh-CN": ["冻雨", "冻雨"], en: ["Ice", "Freezing rain"] },
  67: { kind: "rain", "zh-CN": ["冻雨", "强冻雨"], en: ["Ice", "Heavy freezing rain"] },
  71: { kind: "snow", "zh-CN": ["小雪", "小雪"], en: ["Snow", "Light snow"] },
  73: { kind: "snow", "zh-CN": ["中雪", "中雪"], en: ["Snow", "Snow"] },
  75: { kind: "snow", "zh-CN": ["大雪", "大雪"], en: ["Snow", "Heavy snow"] },
  77: { kind: "snow", "zh-CN": ["米雪", "米雪"], en: ["Snow", "Snow grains"] },
  80: { kind: "rain", "zh-CN": ["阵雨", "小阵雨"], en: ["Shower", "Light showers"] },
  81: { kind: "rain", "zh-CN": ["阵雨", "阵雨"], en: ["Shower", "Showers"] },
  82: { kind: "rain", "zh-CN": ["强阵雨", "强阵雨"], en: ["Shower", "Heavy showers"] },
  85: { kind: "snow", "zh-CN": ["阵雪", "小阵雪"], en: ["Snow", "Snow showers"] },
  86: { kind: "snow", "zh-CN": ["阵雪", "强阵雪"], en: ["Snow", "Heavy snow showers"] },
  95: { kind: "storm", "zh-CN": ["雷阵雨", "雷阵雨"], en: ["Storm", "Thunderstorm"] },
  96: { kind: "storm", "zh-CN": ["雷雨", "雷雨伴冰雹"], en: ["Storm", "Thunderstorm, hail"] },
  99: { kind: "storm", "zh-CN": ["雷雨", "强雷雨伴冰雹"], en: ["Storm", "Severe thunderstorm"] },
};

export function conditionLabel(code: number, locale: Locale, short = false): string {
  const entry = CODES[code];
  if (!entry) return locale === "zh-CN" ? "未知" : "Unknown";
  return entry[locale][short ? 0 : 1];
}

export function conditionKind(code: number): ConditionKind {
  return CODES[code]?.kind ?? "cloudy";
}
