export type UnitCategory = "length" | "area" | "volume" | "weight" | "temperature" | "speed" | "time" | "data";

export interface Unit {
  id: string;
  factor?: number;
  toBase?: (value: number) => number;
  fromBase?: (value: number) => number;
}

const linear = (id: string, factor: number): Unit => ({ id, factor });

export const UNITS: Record<UnitCategory, Unit[]> = {
  length: [
    linear("km", 1000),
    linear("m", 1),
    linear("dm", 0.1),
    linear("cm", 0.01),
    linear("mm", 0.001),
    linear("um", 1e-6),
    linear("nm", 1e-9),
    linear("li", 500),
    linear("zhang", 10 / 3),
    linear("chi", 1 / 3),
    linear("cun", 1 / 30),
    linear("mi", 1609.344),
    linear("yd", 0.9144),
    linear("ft", 0.3048),
    linear("in", 0.0254),
    linear("nmi", 1852),
  ],
  area: [
    linear("km2", 1e6),
    linear("ha", 1e4),
    linear("m2", 1),
    linear("dm2", 0.01),
    linear("cm2", 1e-4),
    linear("mm2", 1e-6),
    linear("qing", 200000 / 3),
    linear("mu", 2000 / 3),
    linear("acre", 4046.8564224),
    linear("mi2", 2589988.110336),
    linear("yd2", 0.83612736),
    linear("ft2", 0.09290304),
    linear("in2", 0.00064516),
  ],
  volume: [
    linear("m3", 1000),
    linear("l", 1),
    linear("dl", 0.1),
    linear("cl", 0.01),
    linear("ml", 0.001),
    linear("cm3", 0.001),
    linear("galUs", 3.785411784),
    linear("galUk", 4.54609),
    linear("qtUs", 0.946352946),
    linear("ptUs", 0.473176473),
    linear("cupUs", 0.2365882365),
    linear("flozUs", 0.0295735295625),
    linear("tbsp", 0.01478676478125),
    linear("tsp", 0.00492892159375),
    linear("ft3", 28.316846592),
    linear("in3", 0.016387064),
  ],
  weight: [
    linear("t", 1e6),
    linear("kg", 1000),
    linear("g", 1),
    linear("mg", 0.001),
    linear("ug", 1e-6),
    linear("jin", 500),
    linear("liang", 50),
    linear("qian", 5),
    linear("lb", 453.59237),
    linear("oz", 28.349523125),
    linear("st", 6350.29318),
    linear("ct", 0.2),
    linear("tonUs", 907184.74),
    linear("tonUk", 1016046.9088),
  ],
  temperature: [
    { id: "c", toBase: (v) => v, fromBase: (v) => v },
    { id: "f", toBase: (v) => ((v - 32) * 5) / 9, fromBase: (v) => (v * 9) / 5 + 32 },
    { id: "k", toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 },
    { id: "r", toBase: (v) => ((v - 491.67) * 5) / 9, fromBase: (v) => ((v + 273.15) * 9) / 5 },
    { id: "re", toBase: (v) => v * 1.25, fromBase: (v) => v * 0.8 },
  ],
  speed: [
    linear("mps", 1),
    linear("kmh", 1 / 3.6),
    linear("mph", 0.44704),
    linear("kn", 1852 / 3600),
    linear("fps", 0.3048),
    linear("mach", 340.3),
    linear("c", 299792458),
  ],
  time: [
    linear("ns", 1e-9),
    linear("us", 1e-6),
    linear("ms", 0.001),
    linear("s", 1),
    linear("min", 60),
    linear("h", 3600),
    linear("d", 86400),
    linear("wk", 604800),
    linear("mo", 2629746),
    linear("yr", 31556952),
    linear("dec", 315569520),
    linear("cen", 3155695200),
  ],
  data: [
    linear("bit", 0.125),
    linear("B", 1),
    linear("KB", 1e3),
    linear("MB", 1e6),
    linear("GB", 1e9),
    linear("TB", 1e12),
    linear("PB", 1e15),
    linear("KiB", 1024),
    linear("MiB", 1024 ** 2),
    linear("GiB", 1024 ** 3),
    linear("TiB", 1024 ** 4),
    linear("PiB", 1024 ** 5),
  ],
};

export const DEFAULT_UNIT: Record<UnitCategory, string> = {
  length: "m",
  area: "m2",
  volume: "l",
  weight: "kg",
  temperature: "c",
  speed: "kmh",
  time: "h",
  data: "GB",
};

export const UNIT_CATEGORIES = Object.keys(UNITS) as UnitCategory[];

export function findUnit(category: UnitCategory, id: string): Unit | null {
  return UNITS[category].find((unit) => unit.id === id) ?? null;
}

function toBase(unit: Unit, value: number): number {
  return unit.toBase ? unit.toBase(value) : value * (unit.factor ?? 1);
}

function fromBase(unit: Unit, value: number): number {
  return unit.fromBase ? unit.fromBase(value) : value / (unit.factor ?? 1);
}

export function convertUnit(category: UnitCategory, value: number, from: string, to: string): number | null {
  const source = findUnit(category, from);
  const target = findUnit(category, to);
  if (!source || !target) return null;
  if (from === to) return value;
  return fromBase(target, toBase(source, value));
}

export function convertAll(category: UnitCategory, value: number, from: string): { id: string; value: number }[] {
  const source = findUnit(category, from);
  if (!source) return [];
  const base = toBase(source, value);
  return UNITS[category].filter((unit) => unit.id !== from).map((unit) => ({ id: unit.id, value: fromBase(unit, base) }));
}
