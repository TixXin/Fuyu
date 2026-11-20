export function parseNumber(input: string): number | null {
  const cleaned = input.replace(/[,，\s_]/g, "").replace(/[。]/g, ".");
  if (!cleaned) return null;
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function trimZeros(text: string): string {
  if (!text.includes(".") || text.includes("e")) return text;
  return text.replace(/\.?0+$/, "");
}

export function formatNumber(value: number, digits = 10): string {
  if (!Number.isFinite(value)) return value > 0 ? "∞" : value < 0 ? "-∞" : "—";
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 1e15 || abs < 1e-9) {
    const [mantissa, exponent] = value.toExponential(Math.min(digits, 12) - 1).split("e");
    return `${trimZeros(mantissa)}e${Number(exponent)}`;
  }
  const precise = Number(value.toPrecision(Math.min(Math.max(digits, 1), 15)));
  const decimals = Math.max(0, digits - Math.floor(Math.log10(abs)) - 1);
  const fixed = trimZeros(precise.toFixed(Math.min(decimals, 12)));
  const [whole, fraction] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction ? `${grouped}.${fraction}` : grouped;
}

export function formatPlain(value: number, digits = 10): string {
  return formatNumber(value, digits).replace(/,/g, "");
}

export function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const fixed = (Math.round(value * 100) / 100).toFixed(2);
  const [whole, fraction] = fixed.split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
}

export function formatAmount(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return Math.abs(value) >= 1 ? formatMoney(value) : formatNumber(value, 4);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
