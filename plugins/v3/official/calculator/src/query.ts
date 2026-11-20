import { CURRENCIES } from "./currency.ts";
import { tryEvaluate } from "./expr.ts";
import { CURRENCY_NAMES, UNIT_NAMES } from "./names.ts";
import { UNITS, type UnitCategory } from "./units.ts";

export type Target = { kind: "unit"; category: UnitCategory; id: string } | { kind: "currency"; code: string };

export interface Query {
  value: number;
  from: Target;
  to: Target;
}

const SKIP_IDS = new Set(["speed:c", "temperature:r", "temperature:re", "length:in"]);

const EXTRA: Record<string, string> = {
  "公里": "length:km",
  "英寸": "length:in",
  "inch": "length:in",
  "inches": "length:in",
  "公分": "length:cm",
  "平米": "area:m2",
  "平方": "area:m2",
  "sqm": "area:m2",
  "公斤": "weight:kg",
  "千克": "weight:kg",
  "kilo": "weight:kg",
  "℃": "temperature:c",
  "°c": "temperature:c",
  "摄氏": "temperature:c",
  "℉": "temperature:f",
  "°f": "temperature:f",
  "华氏": "temperature:f",
  "km/h": "speed:kmh",
  "kph": "speed:kmh",
  "m/s": "speed:mps",
  "度": "angle:deg",
  "°": "angle:deg",
  "kw·h": "energy:kWh",
  "$": "currency:USD",
  "¥": "currency:CNY",
  "￥": "currency:CNY",
  "€": "currency:EUR",
  "£": "currency:GBP",
  "元": "currency:CNY",
  "块": "currency:CNY",
  "rmb": "currency:CNY",
  "美金": "currency:USD",
  "刀": "currency:USD",
  "港元": "currency:HKD",
  "台币": "currency:TWD",
  "韩币": "currency:KRW",
  "日币": "currency:JPY",
};

function key(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, "");
}

function buildAliases(): Map<string, Target> {
  const map = new Map<string, Target>();
  const add = (alias: string, target: Target) => {
    const k = key(alias);
    if (k && !map.has(k)) map.set(k, target);
  };
  for (const category of Object.keys(UNITS) as UnitCategory[]) {
    for (const unit of UNITS[category]) {
      const full = `${category}:${unit.id}`;
      if (SKIP_IDS.has(full)) continue;
      add(unit.id, { kind: "unit", category, id: unit.id });
      for (const name of UNIT_NAMES[full] ?? []) {
        for (const part of name.split(/[（）()]/)) {
          const piece = part.trim();
          if (!piece) continue;
          add(piece, { kind: "unit", category, id: unit.id });
          for (const word of piece.split(/\s+/)) if (/[^\x00-\x7f]/.test(word) || word.length > 2) add(word, { kind: "unit", category, id: unit.id });
        }
      }
    }
  }
  for (const code of CURRENCIES) {
    add(code, { kind: "currency", code });
    for (const name of CURRENCY_NAMES[code] ?? []) add(name, { kind: "currency", code });
  }
  for (const [alias, target] of Object.entries(EXTRA)) {
    const [kind, id] = target.split(":");
    if (kind === "currency") map.set(key(alias), { kind: "currency", code: id });
    else map.set(key(alias), { kind: "unit", category: kind as UnitCategory, id });
  }
  map.set("in", { kind: "unit", category: "length", id: "in" });
  return map;
}

let aliases: Map<string, Target> | null = null;

export function resolveUnit(text: string): Target | null {
  aliases ??= buildAliases();
  const k = key(text);
  return aliases.get(k) ?? (k.length > 3 && k.endsWith("s") ? aliases.get(k.slice(0, -1)) : undefined) ?? null;
}

const CONNECTOR = /\s*(?:\bto\b|\bin\b|\binto\b|\bas\b|=|->|→|换成|换算成|转成|转换成|转为|等于多少|等于|是多少|合多少|是)\s*/gi;
const UNIT_TOKEN = "([a-zA-Z°℃℉$€£¥￥\\u4e00-\\u9fff][\\w°²³/·\\u4e00-\\u9fff]*|[$€£¥￥])";

function sameKind(a: Target, b: Target): boolean {
  if (a.kind === "currency" || b.kind === "currency") return a.kind === b.kind;
  return a.category === b.category;
}

function splitAmount(text: string): { amount: string; unit: string } | null {
  const trimmed = text.trim();
  const prefix = /^([$€£¥￥])\s*(.+)$/.exec(trimmed);
  if (prefix) return { amount: prefix[2], unit: prefix[1] };
  const match = new RegExp(`^(.*?(?:[\\d)πe.%!]|\\bans(?=\\s)))\\s*${UNIT_TOKEN}$`, "i").exec(trimmed);
  return match ? { amount: match[1], unit: match[2] } : null;
}

function tryParse(leftText: string, rightText: string, vars: Record<string, number>): Query | null {
  const left = splitAmount(leftText);
  if (!left) return null;
  const from = resolveUnit(left.unit);
  const to = resolveUnit(rightText);
  if (!from || !to || !sameKind(from, to)) return null;
  const value = tryEvaluate(left.amount, vars);
  return value === null ? null : { value, from, to };
}

export function parseQuery(input: string, vars: Record<string, number> = {}): Query | null {
  const text = input.trim().replace(/[?？]$/, "");
  for (const match of text.matchAll(CONNECTOR)) {
    const at = match.index ?? 0;
    const query = tryParse(text.slice(0, at), text.slice(at + match[0].length), vars);
    if (query) return query;
  }
  return null;
}
